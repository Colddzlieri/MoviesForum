import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, from, map, mergeMap, of, shareReplay, switchMap, timeout, toArray } from 'rxjs';
import { MediaItem, MediaType, PagedMediaResult } from '../models/media.models';
import { PlotEnrichmentService } from './plot-enrichment.service';
import { TmdbApiService } from './tmdb-api.service';

export interface SmartMovieResult {
  items: MediaItem[];
  chips: string[];
  summary: string;
}

interface TextProfile {
  original: string;
  terms: string[];
  expandedTerms: string[];
  searchQueries: string[];
  priorityTerms: string[];
  semanticGroups: string[][];
  movieGenreIds: number[];
  tvGenreIds: number[];
  chips: string[];
  minRating: number | null;
  sortBy: string;
  yearFrom: number | null;
}

@Injectable({ providedIn: 'root' })
export class SmartMovieService {
  private readonly detailsCache = new Map<string, Observable<MediaItem>>();
  private readonly semanticRules: Array<{ terms: string[]; words: string[]; queries: string[] }> = [
    { terms: ['space', 'astronaut', 'planet', 'mars', 'alien', 'galaxy', 'mission', 'survival'], words: ['კოსმოს', 'ასტრონავტ', 'მარს', 'პლანეტ', 'გალაქტიკ', 'უცხოპლანეტ', 'მისია'], queries: ['space survival mission', 'stranded in space', 'space survival astronaut', 'lost in space', 'stranded on mars'] },
    { terms: ['survival', 'stranded', 'escape', 'danger', 'island', 'wilderness', 'rescue'], words: ['გადარჩ', 'დაკარგ', 'საფრთხ', 'გაქცევ', 'კუნძულ', 'ტყე', 'მარტო', 'ხაფანგ'], queries: ['survival escape danger', 'stranded rescue wilderness', 'lost island survival'] },
    { terms: ['detective', 'investigation', 'murder', 'killer', 'case', 'crime', 'police'], words: ['დეტექტივ', 'გამოძი', 'მკვლელ', 'საქმე', 'კრიმინალ', 'პოლიცი', 'დანაშაულ'], queries: ['detective murder investigation', 'crime case police', 'killer mystery investigation'] },
    { terms: ['mystery', 'secret', 'disappearance', 'strange', 'hidden truth', 'puzzle', 'twist'], words: ['საიდუმლ', 'უცნაურ', 'გაუჩინარ', 'ამოცან', 'დამალულ', 'სიმართლ', 'მისტიკ'], queries: ['mystery hidden truth', 'strange disappearance', 'secret puzzle twist'] },
    { terms: ['action', 'fight', 'battle', 'chase', 'hero', 'mission', 'rescue', 'revenge'], words: ['ექშენ', 'ბრძოლ', 'დევნ', 'გმირ', 'მისია', 'გადარჩენ', 'შურისძი'], queries: ['action rescue mission', 'fight chase hero', 'revenge battle action'] },
    { terms: ['adventure', 'journey', 'quest', 'treasure', 'exploration', 'island'], words: ['თავგადასავალ', 'მოგზაურ', 'განძ', 'კუნძულ', 'ძიებ', 'ექსპედიცი'], queries: ['adventure journey quest', 'treasure island exploration', 'expedition discovery'] },
    { terms: ['comedy', 'funny', 'friends', 'family', 'awkward', 'workplace', 'satire'], words: ['კომედ', 'სასაცილ', 'იუმორ', 'მეგობრ', 'ოჯახ', 'სამსახურში', 'უხერხულ'], queries: ['funny friends comedy', 'family comedy awkward', 'workplace satire comedy'] },
    { terms: ['drama', 'family', 'emotional', 'life', 'tragedy', 'grief', 'redemption'], words: ['დრამ', 'ოჯახ', 'ემოციურ', 'ცხოვრებ', 'ტრაგედ', 'ტკივილ', 'დანაკარგ', 'პატიებ'], queries: ['emotional family drama', 'life tragedy redemption', 'grief relationship drama'] },
    { terms: ['fantasy', 'magic', 'kingdom', 'dragon', 'wizard', 'curse', 'prophecy'], words: ['ფენტეზ', 'მაგი', 'სამეფ', 'დრაკონ', 'ჯადოქ', 'წყევლ', 'წინასწარმეტყველ'], queries: ['fantasy magic kingdom', 'dragon wizard curse', 'prophecy mythical quest'] },
    { terms: ['horror', 'ghost', 'demon', 'monster', 'haunted', 'possession', 'scary'], words: ['ჰორორ', 'საშინელ', 'მოჩვენ', 'დემონ', 'მონსტრ', 'დასახლებულ', 'შეპყრობ'], queries: ['horror ghost demon', 'haunted possession monster', 'scary supernatural mystery'] },
    { terms: ['supernatural', 'paranormal', 'ghost', 'demon', 'hunter', 'brothers', 'spirits'], words: ['ზებუნებრივ', 'პარანორმალ', 'მოჩვენ', 'დემონ', 'ნადირ', 'ძმა', 'ძმები', 'სული'], queries: ['supernatural hunters ghosts', 'brothers hunt demons', 'paranormal ghost mystery'] },
    { terms: ['romance', 'love', 'couple', 'relationship', 'wedding', 'heartbreak'], words: ['რომანტ', 'სიყვარულ', 'წყვილ', 'ურთიერთობ', 'ქორწილ', 'გული', 'დაშორ'], queries: ['romance love relationship', 'couple wedding heartbreak', 'emotional love story'] },
    { terms: ['thriller', 'suspense', 'danger', 'conspiracy', 'psychological', 'hostage'], words: ['თრილერ', 'დაძაბ', 'საფრთხ', 'შეთქმულ', 'ფსიქოლოგ', 'ტყვე'], queries: ['suspense thriller danger', 'psychological conspiracy thriller', 'hostage escape thriller'] },
    { terms: ['war', 'soldier', 'army', 'battlefield', 'military', 'resistance', 'occupation'], words: ['ომ', 'ჯარისკაც', 'არმი', 'ბრძოლის ველ', 'სამხედრო', 'წინააღმდეგობ', 'ოკუპაცი'], queries: ['war soldier battlefield', 'military resistance occupation', 'army survival war'] },
    { terms: ['robot', 'android', 'artificial intelligence', 'technology', 'future', 'experiment'], words: ['რობოტ', 'ანდროიდ', 'ხელოვნურ ინტელექტ', 'ტექნოლოგ', 'მომავალ', 'ექსპერიმენტ'], queries: ['artificial intelligence robot', 'android future technology', 'science fiction experiment'] },
    { terms: ['superhero', 'powers', 'villain', 'hero', 'save world', 'secret identity'], words: ['სუპერგმირ', 'ძალებ', 'ბოროტმოქმედ', 'გმირ', 'სამყაროს გადარჩ', 'საიდუმლო იდენტობ'], queries: ['superhero powers villain', 'hero save world', 'secret identity superhero'] },
    { terms: ['time loop', 'repeating day', 'same day', 'reliving the same day', 'stuck in time', 'deja vu', 'loop', 'repeat', 'again and again'], words: ['ერთიდაიგივე', 'ერთი და იგივე', 'იგივე დღეს', 'იმავე დღეს', 'ერთ დღეს', 'ბევრჯერ', 'განმეორ', 'მეორდება', 'დროის მარყუჟ', 'დროის ციკლ', 'ისევ და ისევ'], queries: ['time loop', 'repeating same day', 'reliving the same day', 'stuck in a time loop', 'same day over and over', 'groundhog day'] },
    { terms: ['amnesia', 'memory loss', 'forgotten past', 'lost memory', 'identity mystery'], words: ['ამნეზ', 'მეხსიერებ', 'წარსული არ ახსოვს', 'ვერ იხსენებს', 'ვინ არის', 'იდენტობა'], queries: ['amnesia memory loss mystery', 'forgotten past identity', 'lost memory thriller'] },
    { terms: ['body swap', 'switched bodies', 'identity swap', 'different body'], words: ['სხეულები გაცვალ', 'სხეულში იღვიძებს', 'სხვა სხეულში', 'იდენტობის გაცვლ', 'ადგილები გაცვალ'], queries: ['body swap comedy', 'switched bodies', 'identity swap movie'] },
    { terms: ['multiverse', 'parallel universe', 'alternate reality', 'other dimension'], words: ['მულტივერს', 'პარალელურ სამყარ', 'ალტერნატიულ რეალობ', 'სხვა განზომილებ', 'სხვა სამყარო'], queries: ['multiverse parallel universe', 'alternate reality', 'other dimension adventure'] },
    { terms: ['apocalypse', 'post apocalyptic', 'end of world', 'last survivors', 'collapse'], words: ['აპოკალიფს', 'სამყაროს დასასრული', 'ბოლო გადარჩენილ', 'კოლაფს', 'განადგურებულ სამყარ'], queries: ['post apocalyptic survivors', 'end of the world survival', 'apocalypse last survivors'] },
    { terms: ['zombie', 'undead', 'infection outbreak', 'virus apocalypse'], words: ['ზომბი', 'მკვდრები ცოცხლდებიან', 'ვირუსი', 'ინფექცია', 'ეპიდემია'], queries: ['zombie outbreak', 'undead apocalypse', 'virus infection survival'] },
    { terms: ['heist', 'robbery', 'bank robbery', 'thieves', 'crew plan'], words: ['ძარცვ', 'ქურდ', 'ბანკის გაძარცვ', 'გეგმა', 'ბანდა იპარავს'], queries: ['heist robbery crew', 'bank robbery thieves', 'perfect robbery plan'] },
    { terms: ['prison escape', 'escape from prison', 'wrongly imprisoned', 'jail break'], words: ['ციხიდან გაქცევ', 'ციხეში', 'უსამართლოდ დააპატიმრ', 'პატიმარი', 'გაქცევას გეგმავს'], queries: ['prison escape', 'wrongly imprisoned escape', 'jail break thriller'] },
    { terms: ['spy', 'agent', 'undercover', 'secret mission', 'intelligence agency'], words: ['ჯაშუშ', 'აგენტ', 'ფარულად', 'დავალება', 'სპეცსამსახურ', 'მისია'], queries: ['spy secret mission', 'undercover agent', 'intelligence agency thriller'] },
    { terms: ['assassin', 'hitman', 'contract killer', 'professional killer'], words: ['ქილერ', 'მკვლელი დაქირავებული', 'დაქირავებული მკვლელი', 'ასასინ'], queries: ['assassin hitman', 'contract killer action', 'professional killer thriller'] },
    { terms: ['mafia', 'gangster', 'crime family', 'drug cartel', 'organized crime'], words: ['მაფია', 'განგსტერ', 'კარტელ', 'ნარკო', 'კრიმინალური ოჯახი', 'ბანდა'], queries: ['mafia crime family', 'gangster organized crime', 'drug cartel crime'] },
    { terms: ['courtroom', 'lawyer', 'trial', 'judge', 'legal drama', 'wrong accusation'], words: ['სასამართლო', 'ადვოკატ', 'მოსამართლ', 'პროცესი', 'ბრალდებულ', 'უსამართლოდ ადანაშაულებენ'], queries: ['courtroom legal drama', 'lawyer trial', 'wrong accusation court'] },
    { terms: ['sports', 'team', 'coach', 'championship', 'underdog', 'competition'], words: ['სპორტ', 'გუნდი', 'მწვრთნელ', 'ჩემპიონატ', 'შეჯიბრ', 'აუტსაიდერ'], queries: ['sports underdog team', 'coach championship', 'competition sports drama'] },
    { terms: ['music', 'singer', 'band', 'concert', 'fame', 'musician'], words: ['მუსიკ', 'მომღერალ', 'ბენდი', 'კონცერტ', 'ცნობილი ხდება', 'მუსიკოს'], queries: ['musician fame drama', 'singer band concert', 'music career movie'] },
    { terms: ['dance', 'dancer', 'dance competition', 'ballet', 'street dance'], words: ['ცეკვ', 'მოცეკვავ', 'ბალეტ', 'ქუჩის ცეკვა', 'ცეკვის კონკურს'], queries: ['dance competition', 'dancer drama', 'street dance movie'] },
    { terms: ['cooking', 'chef', 'restaurant', 'food', 'kitchen'], words: ['კულინარ', 'შეფ', 'რესტორან', 'საჭმელ', 'სამზარეულ'], queries: ['chef restaurant drama', 'cooking food movie', 'kitchen competition'] },
    { terms: ['school', 'teen', 'student', 'high school', 'coming of age', 'college'], words: ['სკოლ', 'მოსწავლე', 'თინეიჯერ', 'უნივერსიტეტ', 'სტუდენტ', 'გაზრდა'], queries: ['teen high school', 'coming of age student', 'college friendship'] },
    { terms: ['road trip', 'journey by car', 'travel together', 'cross country'], words: ['გზაში', 'მოგზაურობენ მანქანით', 'როუდ ტრიპ', 'ერთად მოგზაურ', 'ქვეყანას კვეთენ'], queries: ['road trip journey', 'travel together comedy', 'cross country road movie'] },
    { terms: ['pirate', 'sea adventure', 'ship', 'treasure map', 'captain'], words: ['მეკობრ', 'გემი', 'ზღვა', 'კაპიტან', 'განძის რუკა'], queries: ['pirate sea adventure', 'treasure map ship', 'captain ocean quest'] },
    { terms: ['vampire', 'blood', 'immortal', 'night creature'], words: ['ვამპირ', 'სისხლს სვამს', 'უკვდავ', 'ღამის არსება'], queries: ['vampire horror romance', 'immortal blood creature', 'vampire supernatural'] },
    { terms: ['werewolf', 'wolf transformation', 'full moon', 'curse'], words: ['მაქცია', 'მგლად იქცევა', 'სავსე მთვარე', 'წყევლა'], queries: ['werewolf transformation', 'full moon curse', 'wolf horror'] },
    { terms: ['witch', 'witchcraft', 'spell', 'coven', 'dark magic'], words: ['ჯადოქარი', 'შელოცვ', 'კოვენი', 'ბნელი მაგია', 'ჯადოქრობა'], queries: ['witchcraft dark magic', 'witch coven', 'spell curse fantasy'] },
    { terms: ['disaster', 'earthquake', 'storm', 'tsunami', 'volcano', 'catastrophe'], words: ['კატასტროფ', 'მიწისძვრ', 'ქარიშხალ', 'ცუნამ', 'ვულკან', 'სტიქია'], queries: ['disaster catastrophe survival', 'earthquake storm tsunami', 'volcano survival movie'] },
    { terms: ['plane crash', 'crash landing', 'airplane survival', 'pilot'], words: ['თვითმფრინავი ჩამოვარდ', 'ავიაკატასტროფ', 'პილოტ', 'იძულებითი დაშვება'], queries: ['plane crash survival', 'crash landing', 'airplane disaster'] },
    { terms: ['kidnapping', 'abduction', 'missing child', 'ransom', 'rescue child'], words: ['გატაცებ', 'ბავშვი დაიკარგა', 'გამოსასყიდ', 'იტაცებენ', 'დაკარგული ბავშვი'], queries: ['kidnapping ransom thriller', 'missing child investigation', 'abduction rescue'] },
    { terms: ['revenge', 'vengeance', 'betrayal', 'payback', 'avenger'], words: ['შურისძი', 'ღალატ', 'სამაგიეროს უხდის', 'ანგარიშსწორ'], queries: ['revenge betrayal thriller', 'vengeance payback action', 'avenger justice'] },
    { terms: ['dystopia', 'dictatorship', 'oppressive society', 'rebellion', 'controlled world'], words: ['დისტოპია', 'დიქტატურ', 'ჩაგრულ საზოგადოებ', 'აჯანყებ', 'კონტროლირებადი სამყარო'], queries: ['dystopian rebellion', 'oppressive society', 'controlled future world'] },
    { terms: ['royal', 'king', 'queen', 'prince', 'princess', 'palace', 'throne'], words: ['მეფე', 'დედოფალ', 'პრინც', 'პრინცეს', 'სასახლე', 'ტახტი', 'სამეფო'], queries: ['royal palace drama', 'king queen throne', 'prince princess romance'] },
    { terms: ['political', 'president', 'government conspiracy', 'election', 'power struggle'], words: ['პოლიტიკ', 'პრეზიდენტ', 'მთავრობ', 'არჩევნ', 'ძალაუფლება', 'შეთქმულება'], queries: ['political conspiracy thriller', 'government power struggle', 'election drama'] },
    { terms: ['medical', 'doctor', 'hospital', 'patient', 'surgery', 'disease'], words: ['ექიმ', 'საავადმყოფო', 'პაციენტ', 'ოპერაცი', 'დაავადებ', 'ქირურგ'], queries: ['medical hospital drama', 'doctor patient', 'surgery disease story'] },
    { terms: ['game', 'deadly game', 'competition to survive', 'tournament', 'players'], words: ['თამაში', 'სასიკვდილო თამაში', 'გადარჩენის თამაში', 'ტურნირ', 'მოთამაშ'], queries: ['deadly game survival', 'players competition to survive', 'tournament action'] },
    { terms: ['hacker', 'cybercrime', 'computer', 'virtual reality', 'internet'], words: ['ჰაკერ', 'კიბერ', 'კომპიუტერ', 'ვირტუალურ რეალობ', 'ინტერნეტ'], queries: ['hacker cybercrime thriller', 'virtual reality sci-fi', 'computer crime'] },
    { terms: ['western', 'cowboy', 'sheriff', 'outlaw', 'frontier'], words: ['ვესტერნ', 'კოვბოი', 'შერიფ', 'ბანდიტ', 'ველური დასავლეთი'], queries: ['western cowboy sheriff', 'outlaw frontier', 'western revenge'] },
    { terms: ['true story', 'biography', 'based on real events', 'real person'], words: ['ნამდვილ ამბავ', 'ბიოგრაფ', 'რეალურ მოვლენ', 'რეალური ადამიანი'], queries: ['based on true story', 'biography real events', 'real person drama'] },
  ];

  private readonly concepts: Array<{
    chip: string;
    movieGenreIds?: number[];
    tvGenreIds?: number[];
    terms: string[];
    words: string[];
  }> = [
    { chip: 'Space', movieGenreIds: [878], tvGenreIds: [10765], terms: ['space', 'astronaut', 'planet', 'mars', 'galaxy', 'alien'], words: ['space', 'astronaut', 'planet', 'mars', 'galaxy', 'alien', 'კოსმოს', 'ასტრონავტ', 'მარს', 'პლანეტ', 'გალაქტიკ', 'უცხოპლანეტ'] },
    { chip: 'Survival', movieGenreIds: [53], tvGenreIds: [18, 9648], terms: ['survival', 'stranded', 'lost', 'danger', 'escape'], words: ['survival', 'stranded', 'lost', 'danger', 'escape', 'გადარჩ', 'დაკარგ', 'საფრთხ', 'გაქცევ', 'მარტო'] },
    { chip: 'Detective', movieGenreIds: [80, 9648], tvGenreIds: [80, 9648], terms: ['detective', 'investigation', 'murder', 'case', 'crime'], words: ['detective', 'investigation', 'murder', 'case', 'crime', 'დეტექტივ', 'გამოძი', 'მკვლელ', 'საქმე', 'კრიმინალ'] },
    { chip: 'Mystery', movieGenreIds: [9648], tvGenreIds: [9648], terms: ['mystery', 'secret', 'puzzle', 'twist', 'disappearance'], words: ['mystery', 'secret', 'puzzle', 'twist', 'disappearance', 'საიდუმლ', 'მისტიკ', 'გაუჩინარ', 'ამოცან', 'უცნაურ'] },
    { chip: 'Action', movieGenreIds: [28], tvGenreIds: [10759], terms: ['action', 'fight', 'battle', 'chase', 'explosion', 'hero'], words: ['action', 'fight', 'battle', 'chase', 'explosion', 'hero', 'ექშენ', 'ბრძოლ', 'დევნ', 'აფეთქ', 'გმირ'] },
    { chip: 'Adventure', movieGenreIds: [12], tvGenreIds: [10759], terms: ['adventure', 'journey', 'quest', 'treasure', 'island'], words: ['adventure', 'journey', 'quest', 'treasure', 'island', 'თავგადასავალ', 'მოგზაურ', 'განძ', 'კუნძულ'] },
    { chip: 'Comedy', movieGenreIds: [35], tvGenreIds: [35], terms: ['comedy', 'funny', 'humor', 'friends', 'laugh'], words: ['comedy', 'funny', 'humor', 'friends', 'laugh', 'კომედ', 'სასაცილ', 'იუმორ', 'მეგობრ'] },
    { chip: 'Drama', movieGenreIds: [18], tvGenreIds: [18], terms: ['drama', 'emotional', 'family', 'life', 'tragedy'], words: ['drama', 'emotional', 'family', 'life', 'tragedy', 'დრამ', 'ემოციურ', 'ოჯახ', 'ცხოვრებ', 'ტრაგედ'] },
    { chip: 'Fantasy', movieGenreIds: [14], tvGenreIds: [10765], terms: ['fantasy', 'magic', 'kingdom', 'dragon', 'wizard'], words: ['fantasy', 'magic', 'kingdom', 'dragon', 'wizard', 'ფენტეზ', 'მაგი', 'სამეფ', 'დრაკონ', 'ჯადოქ'] },
    { chip: 'Horror', movieGenreIds: [27], tvGenreIds: [9648, 10765], terms: ['horror', 'ghost', 'ghosts', 'spirit', 'spirits', 'demon', 'demons', 'haunted', 'monster', 'scary'], words: ['horror', 'ghost', 'ghosts', 'spirit', 'spirits', 'demon', 'demons', 'haunted', 'monster', 'scary', 'ჰორორ', 'მოჩვენ', 'სული', 'დემონ', 'საშიშ', 'მონსტრ'] },
    { chip: 'Supernatural', movieGenreIds: [27, 14, 9648], tvGenreIds: [10765, 9648, 18], terms: ['supernatural', 'paranormal', 'brothers', 'brother', 'siblings', 'hunters', 'hunter', 'hunt', 'ghost', 'ghosts', 'spirits', 'demon', 'demons', 'sam', 'dean', 'winchester'], words: ['supernatural', 'paranormal', 'brother', 'brothers', 'sibling', 'hunter', 'hunters', 'hunt', 'ghost', 'ghosts', 'spirit', 'demon', 'demons', 'ზებუნებრივ', 'ძმა', 'ძმები', 'ნადირ', 'მოჩვენ', 'სული', 'დემონ'] },
    { chip: 'Romance', movieGenreIds: [10749], tvGenreIds: [18], terms: ['romance', 'love', 'couple', 'relationship', 'wedding'], words: ['romance', 'love', 'couple', 'relationship', 'wedding', 'რომანტ', 'სიყვარულ', 'წყვილ', 'ქორწილ'] },
    { chip: 'Thriller', movieGenreIds: [53], tvGenreIds: [9648, 80], terms: ['thriller', 'suspense', 'tense', 'conspiracy', 'danger'], words: ['thriller', 'suspense', 'tense', 'conspiracy', 'danger', 'თრილერ', 'დაძაბ', 'შეთქმულ', 'საფრთხ'] },
    { chip: 'War', movieGenreIds: [10752], tvGenreIds: [10768], terms: ['war', 'soldier', 'army', 'battlefield', 'military'], words: ['war', 'soldier', 'army', 'battlefield', 'military', 'ომ', 'ჯარისკაც', 'არმი', 'სამხედრო'] },
    { chip: 'Robot', movieGenreIds: [878], tvGenreIds: [10765], terms: ['robot', 'android', 'artificial intelligence', 'ai', 'technology'], words: ['robot', 'android', 'artificial intelligence', 'technology', 'რობოტ', 'ანდროიდ', 'ტექნოლოგ', 'ხელოვნურ ინტელექტ'] },
    { chip: 'Superhero', movieGenreIds: [28, 878], tvGenreIds: [10759, 10765], terms: ['superhero', 'powers', 'villain', 'marvel', 'dc'], words: ['superhero', 'powers', 'villain', 'marvel', 'dc', 'სუპერგმირ', 'ძალებ', 'ბოროტმოქმედ'] },
  ];

  private readonly moodRules: Array<{ chip: string; words: string[]; minRating?: number; sortBy?: string; yearFrom?: number }> = [
    { chip: 'High rated', words: ['best', 'top', 'masterpiece', 'high rated', 'კარგი', 'საუკეთესო', 'მაღალ'], minRating: 7 },
    { chip: 'New', words: ['new', 'modern', 'recent', 'latest', 'ახალი', 'თანამედროვე'], yearFrom: new Date().getFullYear() - 5, sortBy: 'popularity.desc' },
    { chip: 'Popular', words: ['popular', 'trending', 'viral', 'famous', 'პოპულარულ', 'ტრენდ'], sortBy: 'popularity.desc' },
    { chip: 'Classic', words: ['classic', 'old', 'retro', '90s', '80s', 'კლასიკ', 'ძველი'], sortBy: 'vote_count.desc' },
  ];

  constructor(
    private readonly tmdb: TmdbApiService,
    private readonly plotEnrichment: PlotEnrichmentService,
  ) {}

  recommendFromText(text: string, page = 1): Observable<SmartMovieResult> {
    const profile = this.profile(text);
    if (!profile.terms.length) {
      return of({ items: [], chips: [], summary: 'Tell ColdMovie what mood, genre or story you want.' });
    }

    return this.collectCandidates(profile, page).pipe(
      map((items) => this.rank(items, profile)),
      switchMap((ranked) => this.enrichCandidates(ranked)),
      map((items) => this.rank(items, profile)),
      switchMap((ranked) => this.enrichLongPlots(ranked)),
      map((items) => ({
        items: this.rank(items, profile).slice(0, 70),
        chips: profile.chips.length ? profile.chips : profile.expandedTerms.slice(0, 8),
        summary: 'Recommendations tuned to your text and ranked by detailed plot similarity.',
      })),
    );
  }

  private collectCandidates(profile: TextProfile, page: number): Observable<MediaItem[]> {
    return forkJoin({
      keywordIds: this.keywordIds([...profile.expandedTerms, ...profile.searchQueries, ...this.storySignatureQueries(profile), ...this.conceptSeedQueries(profile)]),
      wikiTitles: this.plotEnrichment.candidateTitlesFor(this.candidateDiscoveryQueries(profile)),
    }).pipe(
      switchMap(({ keywordIds, wikiTitles }) => {
        const requests: Array<Observable<PagedMediaResult>> = [];
        const safe = (request: Observable<PagedMediaResult>) => request.pipe(timeout({ first: 6000 }), catchError(() => of(this.emptyResult())));
        const englishTerms = profile.expandedTerms.filter((term) => /^[a-z0-9 -]+$/i.test(term));
        const phraseQueries = this.scenarioPhraseQueries(profile);
        const pages = Array.from({ length: 1 }, (_, index) => Math.max(1, page + index));
        const seedQueries = this.conceptSeedQueries(profile);
        const signatureQueries = this.storySignatureQueries(profile);
        const queryPool = [...new Set([...seedQueries, ...profile.searchQueries, ...phraseQueries, ...signatureQueries])].slice(0, 18);

        queryPool.forEach((query, queryIndex) => {
          pages.forEach((pageNumber) => {
            requests.push(safe(this.tmdb.search(query, pageNumber)));
            if (queryIndex < 10 && pageNumber === pages[0]) {
              requests.push(safe(this.tmdb.searchByType('movie', query, pageNumber)));
              requests.push(safe(this.tmdb.searchByType('tv', query, pageNumber)));
            }
          });
        });
        wikiTitles.slice(0, 20).forEach((title) => {
          requests.push(safe(this.tmdb.search(title, 1)));
        });
        englishTerms.slice(0, 6).forEach((term) => pages.slice(0, 1).forEach((pageNumber) => requests.push(safe(this.tmdb.search(term, pageNumber)))));
        this.personQueries(profile).forEach((query) => requests.push(safe(this.tmdb.searchPersonKnownFor(query))));
        pages.slice(0, 2).forEach((pageNumber) => {
          requests.push(safe(this.discoverScenarioPool('movie', pageNumber, null)));
          requests.push(safe(this.discoverScenarioPool('tv', pageNumber, null)));
        });

        if (profile.movieGenreIds.length || profile.tvGenreIds.length) {
          requests.push(safe(this.discoverFromProfile('movie', profile, page, null)));
          requests.push(safe(this.discoverFromProfile('tv', profile, page, null)));
          profile.movieGenreIds
            .slice(0, 3)
            .forEach((genreId) => requests.push(safe(this.discoverFromProfile('movie', { ...profile, movieGenreIds: [genreId] }, page, null))));
          profile.tvGenreIds
            .slice(0, 3)
            .forEach((genreId) => requests.push(safe(this.discoverFromProfile('tv', { ...profile, tvGenreIds: [genreId] }, page, null))));
        }

        if (keywordIds.length) {
          const ids = keywordIds.slice(0, 8).join('|');
          pages.slice(0, 2).forEach((pageNumber) => {
            requests.push(safe(this.discoverFromProfile('movie', profile, pageNumber, ids)));
            requests.push(safe(this.discoverFromProfile('tv', profile, pageNumber, ids)));
          });
        }

        if (!requests.length) {
          requests.push(safe(this.tmdb.search(profile.terms.slice(0, 5).join(' '), page)));
        }

        return forkJoin(requests).pipe(
          map((results) => {
            const merged = new Map<string, MediaItem>();
            results
              .flatMap((result) => result.results)
              .forEach((item) => merged.set(`${item.mediaType}-${item.id}`, item));
            return [...merged.values()].slice(0, 160);
          }),
        );
      }),
    );
  }

  private discoverFromProfile(mediaType: MediaType, profile: TextProfile, page: number, keywordIds: string | null): Observable<PagedMediaResult> {
    const genreIds = mediaType === 'movie' ? profile.movieGenreIds : profile.tvGenreIds;
    return this.tmdb.discover(mediaType, {
      page,
      with_genres: genreIds.length ? genreIds.join('|') : null,
      with_keywords: keywordIds,
      'vote_average.gte': profile.minRating,
      [mediaType === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte']: profile.yearFrom ? `${profile.yearFrom}-01-01` : null,
      sort_by: profile.sortBy,
    });
  }

  private discoverScenarioPool(mediaType: MediaType, page: number, keywordIds: string | null): Observable<PagedMediaResult> {
    return this.tmdb.discover(mediaType, {
      page,
      with_genres: null,
      with_keywords: keywordIds,
      'vote_count.gte': keywordIds ? null : 80,
      sort_by: keywordIds ? 'vote_count.desc' : 'popularity.desc',
    });
  }

  private candidateDiscoveryQueries(profile: TextProfile): string[] {
    return [
      profile.original,
      ...profile.searchQueries,
      ...this.scenarioPhraseQueries(profile),
      ...this.storySignatureQueries(profile),
      ...this.conceptSeedQueries(profile),
      profile.priorityTerms.slice(0, 12).join(' '),
      profile.terms.slice(0, 8).join(' '),
      ...profile.semanticGroups.slice(0, 8).map((group) => group.slice(0, 8).join(' ')),
    ]
      .map((query) => query.trim())
      .filter((query) => query.length >= 4);
  }

  private scenarioPhraseQueries(profile: TextProfile): string[] {
    const tokens = [
      ...profile.priorityTerms,
      ...profile.expandedTerms.filter((term) => /^[a-z0-9 -]+$/i.test(term)),
    ]
      .map((term) => term.toLowerCase().trim())
      .filter((term) => term.length >= 3 && term.length <= 28);
    const unique = [...new Set(tokens)].slice(0, 28);
    const action = unique.filter((term) => this.isActionToken(this.stemScenarioToken(term)) || /cook|hunt|find|search|escape|save|love|fight|investigat|repeat|surviv|travel|dream|become|hide|solve/.test(term));
    const objects = unique.filter((term) => !action.includes(term));
    const pairs: string[] = [];

    action.slice(0, 8).forEach((verb) => {
      objects.slice(0, 14).forEach((object) => pairs.push(`${object} ${verb}`, `${verb} ${object}`));
    });

    profile.semanticGroups.slice(0, 10).forEach((group) => {
      const clean = group.filter((term) => /^[a-z0-9 -]+$/i.test(term)).slice(0, 6);
      if (clean.length >= 2) {
        pairs.push(clean.join(' '));
      }
      this.ngrams(clean, 2).forEach((phrase) => pairs.push(phrase));
      this.ngrams(clean, 3).forEach((phrase) => pairs.push(phrase));
    });

    this.templateScenarioQueries(unique).forEach((query) => pairs.push(query));

    return [...new Set(pairs.map((query) => query.trim()).filter((query) => query.length >= 5))].slice(0, 60);
  }

  private storySignatureQueries(profile: TextProfile): string[] {
    const tokens = [
      ...profile.priorityTerms,
      ...profile.expandedTerms.filter((term) => /^[a-z0-9 -]+$/i.test(term)),
      ...profile.semanticGroups.flat(),
    ]
      .map((term) => term.toLowerCase().trim())
      .filter((term) => term.length >= 3 && term.length <= 32);

    const unique = [...new Set(tokens)];
    const actionTerms = unique.filter((term) => this.scenarioTokens(term).some((token) => this.isActionToken(token))).slice(0, 8);
    const characterTerms = unique
      .filter((term) => /brother|sister|child|father|mother|family|friend|animal|rat|mouse|chef|detective|killer|robot|alien|wizard|hero|princess|king|student|doctor|police|pirate|vampire|monster/.test(term))
      .slice(0, 10);
    const objectTerms = unique
      .filter((term) => !actionTerms.includes(term) && !characterTerms.includes(term) && !this.isGenericScenarioTerm(term))
      .slice(0, 14);

    const queries: string[] = [];
    characterTerms.forEach((character) => {
      actionTerms.forEach((action) => {
        queries.push(`${character} ${action}`);
        objectTerms.slice(0, 8).forEach((object) => {
          queries.push(`${character} ${action} ${object}`);
          queries.push(`${character} ${object} ${action}`);
        });
      });
    });

    objectTerms.slice(0, 8).forEach((first) => {
      objectTerms.slice(0, 8).forEach((second) => {
        if (first !== second) {
          queries.push(`${first} ${second} story`, `${first} ${second} plot`);
        }
      });
    });

    return [...new Set(queries.map((query) => query.trim()).filter((query) => query.length >= 6))].slice(0, 80);
  }

  private conceptSeedQueries(profile: TextProfile): string[] {
    const concepts = this.scenarioConceptFingerprints(`${profile.original} ${profile.priorityTerms.join(' ')} ${profile.searchQueries.join(' ')}`);
    if (!concepts.size) {
      return [];
    }

    const seedMap = new Map<string, string[]>([
      ['time-loop', ['groundhog day', 'time loop movie', 'same day over and over', 'reliving same day', 'stuck in a time loop']],
      ['supernatural-hunters', ['supernatural', 'supernatural tv series', 'supernatural brothers hunt ghosts', 'brothers hunt demons', 'ghost hunters brothers', 'sam dean winchester', 'paranormal hunters series']],
      ['animal-chef', ['ratatouille', 'rat chef restaurant', 'animal chef cooking', 'mouse cooking restaurant', 'animated kitchen chef']],
      ['lost-child-parent', ['missing child parent search', 'father searches for lost child', 'rescue missing child', 'lost son family adventure']],
      ['living-toys', ['toy story', 'living toys owner child', 'toys come to life', 'secret life of toys']],
      ['ocean-fish', ['finding nemo', 'lost fish father search', 'underwater fish adventure', 'ocean rescue child']],
      ['racing-cars', ['cars animated racing', 'racing cars friendship', 'car race driver small town']],
      ['royal-animal-kingdom', ['lion king', 'lion prince kingdom', 'jungle king father death', 'animal kingdom throne']],
      ['ogre-fairytale', ['shrek', 'ogre swamp princess donkey', 'fairy tale monster princess']],
      ['inside-mind-emotions', ['inside out', 'emotions inside mind', 'memory emotions child', 'feelings inside head']],
      ['afterlife-family', ['coco afterlife family', 'dead ancestors music', 'afterlife spirits family memory']],
      ['wizard-school', ['harry potter', 'wizard school magic', 'chosen boy dark lord', 'hogwarts friends']],
      ['ring-quest', ['lord of the rings', 'hobbit ring quest', 'fellowship destroys ring', 'dark lord fantasy journey']],
      ['dragon-viking', ['how to train your dragon', 'dragon viking friendship', 'train dragon creature companion']],
      ['future-robot', ['wall-e', 'robot future earth', 'artificial intelligence robot', 'android future technology']],
      ['simulation-reality', ['the matrix', 'fake reality computer simulation', 'chosen one simulation', 'virtual reality world']],
      ['dinosaur-park', ['jurassic park', 'dinosaur theme park island', 'genetic experiment dinosaurs escape']],
      ['shark-attack', ['jaws', 'killer shark beach town', 'shark attacks ocean', 'summer beach shark']],
      ['sinking-ship-romance', ['titanic', 'poor rich romance sinking ship', 'ship iceberg disaster love story']],
      ['home-alone-burglars', ['home alone', 'child defends house burglars', 'kid home alone thieves']],
      ['alien-child-friendship', ['e.t. the extra-terrestrial', 'child helps alien go home', 'stranded alien friendship']],
      ['flying-house-adventure', ['up animated', 'old man flying house balloons', 'balloon house scout child']],
      ['pirate-treasure', ['pirates of the caribbean', 'pirate cursed treasure', 'captain ship treasure map']],
      ['prison-escape', ['prison escape', 'wrongly imprisoned escape', 'jail break thriller', 'brother prison rescue']],
      ['heist-crew', ['heist crew robbery', 'bank robbery thieves plan', 'perfect robbery crew']],
      ['detective-murder', ['detective murder investigation', 'crime mystery case', 'killer clues investigation']],
      ['revenge-betrayal', ['revenge betrayal justice', 'vengeance payback thriller', 'betrayed hero revenge']],
      ['post-apocalypse', ['post apocalyptic survivors', 'virus outbreak survival', 'zombie infection survival', 'last survivors collapse']],
      ['spy-mission', ['spy secret mission', 'undercover agent thriller', 'intelligence agency conspiracy']],
      ['superhero-origin', ['superhero origin powers', 'masked hero secret identity', 'gets powers saves city']],
      ['school-coming-age', ['high school coming of age', 'teen student friends', 'school friendship drama']],
      ['sports-underdog', ['sports underdog team', 'coach championship', 'competition sports drama']],
      ['music-fame', ['musician fame drama', 'singer band concert', 'music career story']],
      ['medical-hospital', ['medical hospital drama', 'doctor patient surgery', 'hospital disease story']],
    ]);

    return [...concepts]
      .flatMap((concept) => seedMap.get(concept) ?? [])
      .map((query) => query.trim())
      .filter((query) => query.length >= 4)
      .slice(0, 80);
  }

  private templateScenarioQueries(terms: string[]): string[] {
    const set = new Set(terms);
    const hasAny = (...items: string[]) => items.some((item) => set.has(item));
    const queries: string[] = [];

    if (hasAny('rat', 'mouse') && hasAny('chef', 'cook', 'cooking', 'restaurant')) queries.push('rat chef restaurant animation', 'small animal cooking restaurant');
    if (hasAny('fish', 'ocean', 'sea', 'underwater') && hasAny('search', 'find', 'lost', 'father', 'child')) queries.push('lost fish ocean father search', 'underwater fish rescue child');
    if (hasAny('toy', 'toys') && hasAny('owner', 'child', 'come to life')) queries.push('living toys child owner friendship', 'toys come to life owner');
    if (hasAny('car', 'cars', 'race', 'racing')) queries.push('racing cars small town friendship', 'car race driver road');
    if (hasAny('lion', 'king', 'throne', 'jungle')) queries.push('lion king throne jungle father death', 'lion prince kingdom');
    if (hasAny('ogre', 'swamp', 'princess')) queries.push('ogre swamp princess fairy tale', 'monster princess donkey adventure');
    if (hasAny('memory', 'emotion', 'inside head')) queries.push('emotions inside mind memory child', 'inside head emotions memory');
    if (hasAny('death', 'afterlife', 'spirits', 'ancestors')) queries.push('afterlife spirits family memory music', 'dead ancestors afterlife family');
    if (hasAny('wizard', 'magic', 'school')) queries.push('wizard magic school chosen one', 'magic school dark lord');
    if (hasAny('dragon', 'viking')) queries.push('dragon viking friendship train creature', 'train dragon viking');
    if (hasAny('robot', 'future', 'space')) queries.push('lonely robot future earth space', 'robot space future love');
    if (hasAny('time loop', 'same day', 'repeating day')) queries.push('same day over and over time loop', 'reliving same day time loop');
    if (hasAny('brother', 'brothers', 'siblings') && hasAny('ghost', 'demon', 'supernatural')) queries.push('brothers hunt demons ghosts supernatural', 'siblings paranormal hunters');
    if (hasAny('lost child', 'missing child', 'parent search', 'fish', 'ocean')) queries.push('parent searches for missing child', 'lost child rescue adventure', 'lost fish father search ocean');
    if (hasAny('poor rich romance', 'ship', 'sinking ship', 'iceberg')) queries.push('poor rich romance sinking ship iceberg', 'ship disaster love story');
    if (hasAny('dinosaur', 'park', 'genetic experiment')) queries.push('dinosaur park genetic experiment island', 'dinosaurs escape theme park');
    if (hasAny('shark', 'beach', 'ocean attack')) queries.push('shark attacks beach town ocean', 'killer shark summer beach');
    if (hasAny('wizard school', 'chosen boy', 'dark lord')) queries.push('boy wizard school dark lord', 'chosen boy magic school friends');
    if (hasAny('ring quest', 'hobbit', 'fellowship')) queries.push('hobbit ring quest dark lord', 'fellowship destroys ring fantasy journey');
    if (hasAny('flying house', 'balloons', 'old man', 'scout child')) queries.push('old man flying house balloons scout child', 'balloon house adventure old man boy');
    if (hasAny('alien stranded on earth', 'child helps alien')) queries.push('child helps stranded alien go home', 'alien stranded on earth friendship');
    if (hasAny('superhero', 'masked hero', 'gets powers')) queries.push('masked superhero gets powers secret identity', 'superhero saves city villain');
    if (hasAny('child home alone', 'burglars', 'defends house')) queries.push('child home alone defends house burglars', 'family comedy burglars child house');
    if (hasAny('simulation', 'fake reality', 'computer world')) queries.push('fake reality computer simulation chosen one', 'cyberpunk simulation world');
    if (hasAny('pirate', 'cursed treasure', 'caribbean')) queries.push('pirate cursed treasure caribbean captain', 'pirate ship cursed treasure');

    return queries;
  }

  private personQueries(profile: TextProfile): string[] {
    const original = profile.original.trim();
    const englishNamePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g;
    const englishNames = original.match(englishNamePattern) ?? [];
    const directPhrase = profile.terms.length >= 2 && profile.terms.length <= 4 ? profile.original : '';
    return [...new Set([directPhrase, ...englishNames].map((query) => query.trim()).filter((query) => query.length >= 5))].slice(0, 4);
  }

  private keywordIds(terms: string[]): Observable<number[]> {
    const queries = [...new Set([terms.slice(0, 4).join(' '), ...terms])].filter((term) => term.length >= 3).slice(0, 8);
    if (!queries.length) {
      return of([]);
    }

    return forkJoin(queries.map((query) => this.tmdb.searchKeywords(query))).pipe(
      map((groups) => [...new Set(groups.flat())].slice(0, 12)),
      catchError(() => of([])),
    );
  }

  private enrichCandidates(items: MediaItem[]): Observable<MediaItem[]> {
    if (!items.length) {
      return of([]);
    }

    const targetItems = items.slice(0, 24);
    const remainingItems = items.slice(24);

    return from(targetItems).pipe(
      mergeMap((item, index) => this.enrichedItem(item).pipe(map((enriched) => ({ index, enriched }))), 10),
      toArray(),
      map((results) => [...results.sort((a, b) => a.index - b.index).map((result) => result.enriched), ...remainingItems]),
    );
  }

  private enrichLongPlots(items: MediaItem[]): Observable<MediaItem[]> {
    if (!items.length) {
      return of([]);
    }

    const targetItems = items.slice(0, 4);
    const remainingItems = items.slice(4);

    return from(targetItems).pipe(
      mergeMap(
        (item, index) =>
        this.plotEnrichment.plotTextFor(item).pipe(
          map((plotText) => {
            if (!plotText) {
              return { index, enriched: item };
            }
            return {
              index,
              enriched: {
                ...item,
                hiddenPlot: `${item.hiddenPlot} ${plotText} ${this.longPlotSignals(plotText)}`.replace(/\s+/g, ' ').toLowerCase(),
              },
            };
          }),
          catchError(() => of({ index, enriched: item })),
        ),
        6,
      ),
      toArray(),
      map((results) => [...results.sort((a, b) => a.index - b.index).map((result) => result.enriched), ...remainingItems]),
    );
  }

  private longPlotSignals(plotText: string): string {
    const text = plotText.toLowerCase();
    const signals: string[] = [];

    if (/toy|toys|owner|andy|woody|buzz|come to life/.test(text)) signals.push('living toys owner child friendship secret life toys come alive');
    if (/fish|reef|ocean|sea|underwater|shark|aquarium|father searches|lost son/.test(text)) signals.push('fish ocean underwater reef lost child parent search rescue animated adventure');
    if (/car|race|racing|driver|radiator springs|lightning/.test(text)) signals.push('cars racing driver road small town competition friendship');
    if (/lion|pride lands|king|throne|cub|simba|mufasa/.test(text)) signals.push('lion king prince throne father death kingdom jungle coming of age');
    if (/ogre|swamp|donkey|princess|fairy tale|fiona/.test(text)) signals.push('ogre swamp princess donkey fairy tale monster unlikely hero');
    if (/emotion|memory|mind|joy|sadness|inside/.test(text)) signals.push('inside mind emotions memory child growing up feelings');
    if (/dead|death|afterlife|spirits|remember|music|mexico|ancestor/.test(text)) signals.push('death afterlife spirits family memory music ancestors');
    if (/robot|waste|earth|plant|spacecraft|wall-e|eve/.test(text)) signals.push('lonely robot future earth space environmental love');
    if (/ice age|mammoth|sloth|saber|baby/.test(text)) signals.push('prehistoric animals mammoth sloth baby journey family');
    if (/dragon|viking|train|toothless/.test(text)) signals.push('dragon viking friendship train creature adventure');
    if (/school|monster|scare|university/.test(text)) signals.push('monster school training friendship competition');
    if (/wizard|hogwarts|magic|spell|voldemort/.test(text)) signals.push('wizard school magic chosen one dark lord friendship');
    if (/ring|hobbit|middle-earth|fellowship|sauron/.test(text)) signals.push('fantasy quest ring hobbit fellowship dark lord journey');
    if (/superhero|powers|villain|save the world|secret identity/.test(text)) signals.push('superhero powers villain save world secret identity');
    if (/detective|murder|investigation|killer|case|clues/.test(text)) signals.push('detective murder investigation clues killer mystery case');
    if (/time loop|same day|over and over|relives|repeating/.test(text)) signals.push('time loop same day repeating reliving stuck in time');
    if (/ship|iceberg|sinking|atlantic|poor|wealthy|aristocrat/.test(text)) signals.push('sinking ship iceberg disaster poor rich romance tragic love');
    if (/dinosaur|jurassic|theme park|genetic|island/.test(text)) signals.push('dinosaur park island genetic experiment creatures escape');
    if (/shark|beach|summer resort|police chief|orca/.test(text)) signals.push('killer shark beach town ocean attack summer danger');
    if (/balloon|floating house|paradise falls|wilderness explorer|old man/.test(text)) signals.push('old man child scout flying house balloons adventure journey');
    if (/alien|phone home|extraterrestrial|bicycle|elliott/.test(text)) signals.push('stranded alien child friendship go home bicycle');
    if (/burglars|home alone|booby traps|christmas|mccallister/.test(text)) signals.push('child home alone burglars traps family christmas comedy');
    if (/simulation|matrix|neo|morpheus|artificial reality/.test(text)) signals.push('simulation fake reality chosen one cyberpunk computer world');
    if (/pirate|black pearl|cursed treasure|caribbean|captain jack/.test(text)) signals.push('pirate ship cursed treasure caribbean captain adventure');
    if (/boxing|fighter|champion|underdog|trainer/.test(text)) signals.push('boxing underdog fighter champion trainer sports drama');
    if (/serial killer|fbi trainee|cannibal|hannibal/.test(text)) signals.push('serial killer fbi trainee cannibal investigation thriller');
    if (/mafia|godfather|crime family|corleone/.test(text)) signals.push('mafia crime family godfather organized crime power');
    if (/bank robbery|heist|crew|vault/.test(text)) signals.push('heist bank robbery crew plan vault crime');

    return signals.join(' ');
  }

  private enrichedItem(item: MediaItem): Observable<MediaItem> {
    const key = `${item.mediaType}-${item.id}`;
    const cached = this.detailsCache.get(key);
    if (cached) {
      return cached;
    }

    const request = this.tmdb.details(item.mediaType, item.id).pipe(
      timeout({ first: 9000 }),
      map((details) => ({
        ...item,
        description: details.description,
        shortDescription: details.shortDescription,
        hiddenPlot: details.hiddenPlot,
        genres: details.genres.length ? details.genres : item.genres,
        genreIds: details.genreIds.length ? details.genreIds : item.genreIds,
      })),
      catchError(() => of(item)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.detailsCache.set(key, request);
    return request;
  }

  private profile(text: string): TextProfile {
    const original = text.trim();
    const normalized = original.toLowerCase();
    const terms = normalized
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 2);

    const expanded = new Set<string>(terms);
    const priorityTerms = new Set<string>();
    const semanticGroups: string[][] = [];
    const movieGenreIds = new Set<number>();
    const tvGenreIds = new Set<number>();
    const chips = new Set<string>();
    let minRating: number | null = null;
    let sortBy = 'popularity.desc';
    let yearFrom: number | null = null;

    this.universalScenarioConcepts(normalized).forEach((match) => {
      chips.add(match.chip);
      match.terms.forEach((term) => expanded.add(term));
      match.terms.forEach((term) => priorityTerms.add(term));
      match.queries.forEach((query) => expanded.add(query));
      semanticGroups.push(match.terms);
      match.movieGenreIds?.forEach((id) => movieGenreIds.add(id));
      match.tvGenreIds?.forEach((id) => tvGenreIds.add(id));
    });

    this.georgianTermExpansions(normalized).forEach((term) => {
      expanded.add(term);
      priorityTerms.add(term);
    });

    this.unicodeGeorgianScenarioExpansions(normalized).forEach((match) => {
      chips.add(match.chip);
      match.terms.forEach((term) => expanded.add(term));
      match.terms.forEach((term) => priorityTerms.add(term));
      match.queries.forEach((query) => expanded.add(query));
      semanticGroups.push(match.terms);
      match.movieGenreIds?.forEach((id) => movieGenreIds.add(id));
      match.tvGenreIds?.forEach((id) => tvGenreIds.add(id));
    });

    this.localizedScenarioExpansions(normalized).forEach((match) => {
      chips.add(match.chip);
      match.terms.forEach((term) => expanded.add(term));
      match.terms.forEach((term) => priorityTerms.add(term));
      match.queries.forEach((query) => expanded.add(query));
      semanticGroups.push(match.terms);
      match.movieGenreIds?.forEach((id) => movieGenreIds.add(id));
      match.tvGenreIds?.forEach((id) => tvGenreIds.add(id));
    });

    this.concepts.forEach((concept) => {
      if (concept.words.some((word) => normalized.includes(word))) {
        chips.add(concept.chip);
        concept.terms.forEach((term) => expanded.add(term));
        concept.terms.forEach((term) => priorityTerms.add(term));
        concept.movieGenreIds?.forEach((id) => movieGenreIds.add(id));
        concept.tvGenreIds?.forEach((id) => tvGenreIds.add(id));
      }
    });

    this.semanticRules.forEach((rule) => {
      if (rule.words.some((word) => normalized.includes(word)) || rule.terms.some((term) => normalized.includes(term))) {
        rule.terms.forEach((term) => expanded.add(term));
        rule.terms.forEach((term) => priorityTerms.add(term));
        rule.queries.forEach((query) => expanded.add(query));
        semanticGroups.push(rule.terms);
      }
    });

    this.moodRules.forEach((rule) => {
      if (rule.words.some((word) => normalized.includes(word))) {
        chips.add(rule.chip);
        if (rule.minRating) {
          minRating = Math.max(minRating ?? 0, rule.minRating);
        }
        sortBy = rule.sortBy ?? sortBy;
        yearFrom = Math.max(yearFrom ?? 0, rule.yearFrom ?? 0) || yearFrom;
      }
    });

    this.fallbackScenarioGroups(terms).forEach((group) => {
      semanticGroups.push(group);
      group.forEach((term) => priorityTerms.add(term));
    });

    const expandedTerms = [...expanded].filter((term) => term.length > 2).slice(0, 140);
    const searchQueries = this.buildSearchQueries(expandedTerms, [...chips], normalized);

    return {
      original,
      terms: [...new Set(terms)].slice(0, 18),
      expandedTerms,
      searchQueries,
      priorityTerms: [...priorityTerms].filter((term) => term.length > 2).slice(0, 70),
      semanticGroups: semanticGroups.slice(0, 16),
      movieGenreIds: [...movieGenreIds].slice(0, 5),
      tvGenreIds: [...tvGenreIds].slice(0, 5),
      chips: [...chips].slice(0, 10),
      minRating,
      sortBy,
      yearFrom,
    };
  }

  private georgianTermExpansions(normalized: string): string[] {
    const dictionary: Array<{ pattern: RegExp; terms: string[] }> = [
      { pattern: /ვირთხ|თაგვ/, terms: ['rat', 'mouse', 'small animal'] },
      { pattern: /ცხოველ|არსება|მხეც/, terms: ['animal', 'creature', 'beast'] },
      { pattern: /მზარეულ|შეფ|ამზად|საჭმელ|სამზარეულ|რესტორან|კულინარ/, terms: ['chef', 'cook', 'cooking', 'food', 'kitchen', 'restaurant', 'culinary'] },
      { pattern: /მოჩვენ|სული|დემონ|ზებუნებრივ|პარანორმალ/, terms: ['ghost', 'spirit', 'demon', 'supernatural', 'paranormal'] },
      { pattern: /ძმა|ძმები|და|ოჯახ|მამა|დედა|შვილ/, terms: ['brother', 'siblings', 'family', 'father', 'mother', 'child'] },
      { pattern: /ნადირ|ეძებ|პოულობ|გამოძი|დეტექტივ/, terms: ['hunt', 'search', 'find', 'investigation', 'detective'] },
      { pattern: /ერთიდაიგივე|იგივე დღე|იმავე დღე|ბევრჯერ|მეორდება|დროის მარყუჟ/, terms: ['time loop', 'same day', 'repeating day', 'over and over', 'reliving'] },
      { pattern: /კოსმოს|მარს|პლანეტ|ასტრონავტ|უცხოპლანეტ/, terms: ['space', 'mars', 'planet', 'astronaut', 'alien'] },
      { pattern: /რობოტ|ხელოვნურ ინტელექტ|ანდროიდ|ტექნოლოგ|მომავალ/, terms: ['robot', 'artificial intelligence', 'android', 'technology', 'future'] },
      { pattern: /სიყვარულ|შეყვარ|წყვილ|ქორწილ/, terms: ['love', 'romance', 'couple', 'relationship', 'wedding'] },
      { pattern: /გაქცევ|გადარჩენ|ხაფანგ|დაკარგ|საფრთხ/, terms: ['escape', 'survival', 'trapped', 'lost', 'danger'] },
      { pattern: /მაგი|ჯადოქ|წყევლ|დრაკონ|სამეფ/, terms: ['magic', 'witch', 'curse', 'dragon', 'kingdom', 'fantasy'] },
      { pattern: /სკოლ|მოსწავლ|სტუდენტ|თინეიჯ/, terms: ['school', 'student', 'teen', 'college'] },
      { pattern: /შურისძი|ღალატ|სამართალ/, terms: ['revenge', 'betrayal', 'justice'] },
      { pattern: /ანიმაც|ანიმე|მულტფილმ/, terms: ['animation', 'anime', 'cartoon', 'animated'] },
    ];

    dictionary.push(
      { pattern: /ვირთხ|თაგვ/, terms: ['rat', 'mouse', 'small animal'] },
      { pattern: /ცხოველ|არსება|მხეც|მონსტრ|უცხოპლანეტ|დრაკონ|ზვიგენ|დინოზავრ|ძაღლ|კატა/, terms: ['animal', 'creature', 'beast', 'monster', 'alien', 'dragon', 'shark', 'dinosaur', 'dog', 'cat'] },
      { pattern: /მზარეულ|შეფ|ამზად|საჭმელ|სამზარეულ|რესტორან|კულინარ|საკვებ|ჭამ/, terms: ['chef', 'cook', 'cooking', 'food', 'kitchen', 'restaurant', 'culinary', 'meal'] },
      { pattern: /მოჩვენ|სული|დემონ|ზებუნებრივ|პარანორმალ|წყევლ|შელოც|ჯადოქ/, terms: ['ghost', 'spirit', 'demon', 'supernatural', 'paranormal', 'curse', 'spell', 'witch'] },
      { pattern: /ძმა|ძმები|და-ძმა|ოჯახ|მამა|დედა|შვილ|ბავშვ|მშობელ/, terms: ['brother', 'brothers', 'siblings', 'family', 'father', 'mother', 'child', 'parent'] },
      { pattern: /ნადირ|ეძებ|პოულობ|გამოძი|დეტექტივ|საქმე|მკვლელ|დამნაშავ/, terms: ['hunt', 'search', 'find', 'investigation', 'detective', 'case', 'killer', 'criminal'] },
      { pattern: /ერთიდაიგივე|ერთი და იგივე|იგივე დღე|იმავე დღე|ბევრჯერ|მეორდება|დროის მარყუჟ|დროის ციკლ/, terms: ['time loop', 'same day', 'repeating day', 'over and over', 'reliving', 'stuck in time'] },
      { pattern: /კოსმოს|მარს|პლანეტ|ასტრონავტ|უცხოპლანეტ|გალაქტიკ/, terms: ['space', 'mars', 'planet', 'astronaut', 'alien', 'galaxy'] },
      { pattern: /რობოტ|ხელოვნურ ინტელექტ|ანდროიდ|ტექნოლოგ|მომავალ|ვირტუალურ/, terms: ['robot', 'artificial intelligence', 'android', 'technology', 'future', 'virtual reality'] },
      { pattern: /სიყვარულ|შეყვარ|წყვილ|ქორწილ|დაშორ|გული/, terms: ['love', 'romance', 'couple', 'relationship', 'wedding', 'heartbreak'] },
      { pattern: /გაქცევ|გადარჩენ|ხაფანგ|დაკარგ|საფრთხ|ტყვე|იტაც/, terms: ['escape', 'survival', 'trapped', 'lost', 'danger', 'hostage', 'kidnapping'] },
      { pattern: /მაგი|ჯადოქ|წყევლ|დრაკონ|სამეფ|პრინც|პრინცეს|სასახლ|ზღაპ/, terms: ['magic', 'witch', 'curse', 'dragon', 'kingdom', 'prince', 'princess', 'palace', 'fairy tale'] },
      { pattern: /სკოლ|მოსწავლ|სტუდენტ|თინეიჯ|უნივერსიტეტ|კლას/, terms: ['school', 'student', 'teen', 'college', 'classroom'] },
      { pattern: /შურისძი|ღალატ|სამართალ|ანგარიშსწორ|მკვლელობა/, terms: ['revenge', 'betrayal', 'justice', 'payback', 'murder'] },
      { pattern: /ანიმაც|ანიმე|მულტფილმ|ნახატი/, terms: ['animation', 'anime', 'cartoon', 'animated'] },
      { pattern: /თევზ|ოკეან|ზღვ|კუნძულ|პლაჟ|წყალქვეშ/, terms: ['fish', 'ocean', 'sea', 'island', 'reef', 'underwater', 'marine'] },
      { pattern: /სათამაშ|თოჯინ|ცოცხლდებ|პატრონ/, terms: ['toy', 'toys', 'come to life', 'owner', 'child', 'friendship'] },
      { pattern: /მანქან|რბოლ|მძღოლ|გზა/, terms: ['car', 'cars', 'race', 'racing', 'driver', 'road'] },
      { pattern: /ლომ|მეფ|ტახტ|სამეფ|ჯუნგლ/, terms: ['lion', 'king', 'throne', 'kingdom', 'jungle', 'prince'] },
      { pattern: /ოგრ|ურჩხულ|მონსტრ|ჭაობ|უმახინჯ/, terms: ['ogre', 'monster', 'swamp', 'fairy tale', 'unlikely hero'] },
      { pattern: /მეხსიერ|ავიწყ|ემოც|გრძნობა|თავში|გონება/, terms: ['memory', 'forget', 'mind', 'emotion', 'inside head', 'feelings'] },
      { pattern: /სიზმარ|ძილ|კოშმარ/, terms: ['dream', 'sleep', 'nightmare', 'surreal'] },
      { pattern: /სიკვდილ|მკვდარ|სულებ|მექსიკ|წინაპარ|საიქიო/, terms: ['death', 'dead', 'spirits', 'afterlife', 'family memory', 'ancestors'] },
      { pattern: /მეგობრ|ერთგულ|გუნდი|თანამგზავრ/, terms: ['friends', 'friendship', 'team', 'companions', 'loyalty'] },
      { pattern: /მოგზაურ|მისია|თავგადასავალ|განძ|რუკა|ექსპედიცი/, terms: ['journey', 'mission', 'adventure', 'treasure', 'map', 'expedition'] },
      { pattern: /ომ|ჯარისკაც|არმია|ბრძოლ|სამხედრო/, terms: ['war', 'soldier', 'army', 'battle', 'military'] },
      { pattern: /სპორტ|შეჯიბრ|ტურნირ|ჩემპიონ|მწვრთნელ/, terms: ['sports', 'competition', 'tournament', 'championship', 'coach'] },
      { pattern: /მუსიკ|მომღერ|სიმღერ|გიტარ|კონცერტ/, terms: ['music', 'singer', 'song', 'guitar', 'concert'] },
      { pattern: /დაკარგულ|იკარგ|მოიტაც|შვილის ძებნ|ბავშვის ძებნ/, terms: ['lost child', 'missing child', 'parent search', 'rescue child', 'family rescue'] },
      { pattern: /ღარიბ|მდიდარ|გემი|ტიტანიკ|ჩაძირვ|აისბერგ/, terms: ['poor rich romance', 'ship', 'sinking ship', 'iceberg', 'disaster romance'] },
      { pattern: /დინოზავრ|პარკ|კუნძულ|გენეტიკ/, terms: ['dinosaur', 'park', 'island', 'genetic experiment', 'creatures escape'] },
      { pattern: /ზვიგენ|სანაპირო|პლაჟ|ზღვაში ესხმის/, terms: ['shark', 'beach', 'ocean attack', 'summer town', 'danger at sea'] },
      { pattern: /ჯადოქრების სკოლ|ჰოგვარტს|არჩეული ბიჭი|ბნელი ლორდ/, terms: ['wizard school', 'chosen boy', 'dark lord', 'magic friends'] },
      { pattern: /ბეჭედ|ჰობიტ|ბოროტი მეფე|ფენტეზი მოგზაურ/, terms: ['ring quest', 'hobbit', 'dark lord', 'fellowship', 'fantasy journey'] },
      { pattern: /ბურთულ|სახლი ფრინავს|მოხუცი|სკაუტ|ბავშვი მოგზაურობს/, terms: ['flying house', 'balloons', 'old man', 'scout child', 'adventure journey'] },
      { pattern: /უცხოპლანეტელი სახლში|ბავშვი ეხმარება უცხოს|ველოსიპედით/, terms: ['alien stranded on earth', 'child helps alien', 'go home', 'friendship'] },
      { pattern: /დრაკონს წვრთნის|ვიკინგ|დრაკონის მეგობარი/, terms: ['train dragon', 'viking', 'dragon friendship', 'creature companion'] },
      { pattern: /სუპერგმირ|ნიღაბ|ობობა|ძალა მიიღო|სამყაროს გადარჩენა/, terms: ['superhero', 'masked hero', 'gets powers', 'save the city', 'secret identity'] },
      { pattern: /სახლში მარტო|ქურდები|ბავშვი იცავს სახლს/, terms: ['child home alone', 'burglars', 'defends house', 'family comedy'] },
      { pattern: /მატრიც|სიმულაცი|რეალობა ყალბია|კომპიუტერულ სამყაროში/, terms: ['simulation', 'fake reality', 'computer world', 'chosen one', 'cyberpunk'] },
      { pattern: /მეკობრ|კარიბ|გემი|წყევლილი განძი/, terms: ['pirate', 'ship', 'cursed treasure', 'caribbean', 'captain'] },
      { pattern: /áƒ—áƒ”áƒ•áƒ–|áƒáƒ™áƒ”áƒáƒœ|áƒ–áƒ¦áƒ•|áƒ™áƒ£áƒœáƒ«áƒ£áƒš|áƒžáƒšáƒáƒŸ/, terms: ['fish', 'ocean', 'sea', 'island', 'reef', 'underwater', 'marine'] },
      { pattern: /áƒ¡áƒáƒ—áƒáƒ›áƒáƒ¨|áƒ—áƒáƒ¯áƒ˜áƒœ|áƒªáƒáƒªáƒ®áƒšáƒ“áƒ”áƒ‘|áƒžáƒáƒ¢áƒ áƒáƒœ/, terms: ['toy', 'toys', 'come to life', 'owner', 'child', 'friendship'] },
      { pattern: /áƒ›áƒáƒœáƒ¥áƒáƒœ|áƒ áƒ‘áƒáƒš|áƒ›áƒ áƒ‘áƒáƒš|áƒ’áƒ–áƒ/, terms: ['car', 'cars', 'race', 'racing', 'driver', 'road'] },
      { pattern: /áƒšáƒáƒ›|áƒ›áƒ”áƒ¤|áƒ¢áƒáƒ®áƒ¢|áƒ¡áƒáƒ›áƒ”áƒ¤|áƒ¯áƒ£áƒœáƒ’áƒš/, terms: ['lion', 'king', 'throne', 'kingdom', 'jungle', 'prince'] },
      { pattern: /áƒžáƒ áƒ˜áƒœáƒªáƒ”áƒ¡|áƒžáƒ áƒ˜áƒœáƒª|áƒ¡áƒáƒ¡áƒáƒ®áƒš|áƒ“áƒ”áƒ“áƒáƒ¤/, terms: ['princess', 'prince', 'palace', 'queen', 'royal', 'fairy tale'] },
      { pattern: /áƒáƒ’áƒ |áƒ›áƒáƒœáƒ¡áƒ¢áƒ |áƒ£áƒ›áƒáƒ®áƒ˜áƒœáƒ¯|áƒ­áƒáƒáƒ‘/, terms: ['ogre', 'monster', 'swamp', 'fairy tale', 'unlikely hero'] },
      { pattern: /áƒ›áƒ”áƒ®áƒ¡áƒ˜áƒ”áƒ |áƒáƒ•áƒ˜áƒ¬áƒ§|áƒ£áƒœáƒáƒ |áƒ—áƒáƒ•áƒ¨áƒ˜/, terms: ['memory', 'forget', 'mind', 'emotion', 'inside head'] },
      { pattern: /áƒ¡áƒ˜áƒ–áƒ›áƒáƒ |áƒ«áƒ˜áƒš|áƒ™áƒáƒ¨áƒ›áƒáƒ /, terms: ['dream', 'sleep', 'nightmare', 'surreal'] },
      { pattern: /áƒ¡áƒ˜áƒ™áƒ•áƒ“áƒ˜áƒš|áƒ›áƒ™áƒ•áƒ“áƒáƒ |áƒ¡áƒ£áƒšáƒ”áƒ‘|áƒ›áƒ”áƒ¥áƒ¡áƒ˜áƒ™/, terms: ['death', 'dead', 'spirits', 'afterlife', 'family memory'] },
    );

    return [...new Set(dictionary.filter((item) => item.pattern.test(normalized)).flatMap((item) => item.terms))];
  }

  private unicodeGeorgianScenarioExpansions(normalized: string): Array<{
    chip: string;
    terms: string[];
    queries: string[];
    movieGenreIds?: number[];
    tvGenreIds?: number[];
  }> {
    const matches: Array<{
      chip: string;
      terms: string[];
      queries: string[];
      movieGenreIds?: number[];
      tvGenreIds?: number[];
    }> = [];
    const has = (...patterns: RegExp[]) => patterns.some((pattern) => pattern.test(normalized));

    const ratOrMouse = /(?:\u10D5\u10D8\u10E0\u10D7\u10EE|\u10D7\u10D0\u10D2\u10D5)/u;
    const cooking = /(?:\u10DB\u10D6\u10D0\u10E0\u10D4\u10E3\u10DA|\u10E8\u10D4\u10E4|\u10E1\u10D0\u10ED\u10DB\u10D4\u10DA|\u10E1\u10D0\u10DB\u10D6\u10D0\u10E0\u10D4\u10E3\u10DA|\u10E0\u10D4\u10E1\u10E2\u10DD\u10E0\u10D0\u10DC|\u10D0\u10DB\u10D6\u10D0\u10D3|\u10D4\u10EE\u10DB\u10D0\u10E0)/u;
    if (has(ratOrMouse) && has(cooking)) {
      matches.push({
        chip: 'Animal chef',
        terms: ['rat', 'mouse', 'animal', 'chef', 'cook', 'cooking', 'restaurant', 'kitchen', 'food', 'paris', 'animation', 'secret talent', 'dream', 'unlikely hero', 'remy', 'linguini'],
        queries: ['ratatouille', 'rat chef restaurant animation', 'mouse cooking restaurant', 'animal chef cooking', 'animated kitchen chef'],
        movieGenreIds: [16, 35, 10751],
        tvGenreIds: [16, 10762],
      });
    }

    const brothers = /(?:\u10EB\u10DB\u10D0|\u10EB\u10DB\u10D4\u10D1|\u10DD\u10EF\u10D0\u10EE)/u;
    const ghosts = /(?:\u10DB\u10DD\u10E9\u10D5\u10D4\u10DC|\u10E1\u10E3\u10DA|\u10D3\u10D4\u10DB\u10DD\u10DC|\u10D6\u10D4\u10D1\u10E3\u10DC\u10D4\u10D1\u10E0\u10D8\u10D5)/u;
    const hunting = /(?:\u10DC\u10D0\u10D3\u10D8\u10E0|\u10D4\u10EB\u10D4\u10D1|\u10D4\u10D1\u10E0\u10EB\u10DD\u10DA|\u10D8\u10EB\u10D8\u10D4\u10D1)/u;
    if (has(brothers) && has(ghosts) && has(hunting)) {
      matches.push({
        chip: 'Supernatural case',
        terms: ['supernatural', 'paranormal', 'brothers', 'siblings', 'hunters', 'hunt', 'ghosts', 'spirits', 'demons', 'monster', 'case', 'sam', 'dean', 'winchester'],
        queries: ['supernatural', 'brothers hunt ghosts', 'brothers hunt demons', 'sam dean winchester', 'paranormal hunters brothers'],
        movieGenreIds: [27, 14, 9648],
        tvGenreIds: [10765, 9648, 18],
      });
    }

    const repeatedDay = /(?:\u10D4\u10E0\u10D7\u10D8\u10D3\u10D0\u10D8\u10D2\u10D8\u10D5\u10D4|\u10D8\u10D2\u10D8\u10D5\u10D4\s+\u10D3\u10E6\u10D4|\u10D1\u10D4\u10D5\u10E0\u10EF\u10D4\u10E0|\u10D2\u10D0\u10DC\u10DB\u10D4\u10DD\u10E0|\u10D3\u10E0\u10DD\u10D8\u10E1\s+\u10EA\u10D8\u10D9\u10DA)/u;
    if (has(repeatedDay)) {
      matches.push({
        chip: 'Time loop',
        terms: ['time loop', 'same day', 'repeating day', 'reliving same day', 'stuck in time', 'loop', 'repeat', 'again and again', 'deja vu'],
        queries: ['groundhog day', 'time loop', 'same day over and over', 'reliving the same day', 'stuck in a time loop'],
        movieGenreIds: [35, 14, 878],
        tvGenreIds: [10765, 9648],
      });
    }

    return matches;
  }

  private universalScenarioConcepts(normalized: string): Array<{
    chip: string;
    terms: string[];
    queries: string[];
    movieGenreIds?: number[];
    tvGenreIds?: number[];
  }> {
    const concepts: Array<{
      chip: string;
      patterns: RegExp[];
      terms: string[];
      queries: string[];
      movieGenreIds?: number[];
      tvGenreIds?: number[];
    }> = [
      { chip: 'Creature', patterns: [/ცხოველ|არსება|მხეც|მონსტრ|უცხო|უცხოპლანეტ|დრაკონ|ზვიგენ|დინოზავრ|დათვ|ძაღლ|კატ|თაგვ|ვირთხ|მაიმუნ|animal|creature|monster|alien|dragon|shark|dinosaur|dog|cat|mouse|rat|ape/], terms: ['animal', 'creature', 'monster', 'alien', 'beast', 'non human character'], queries: ['animal creature story', 'monster creature movie', 'non human character'], movieGenreIds: [12, 14, 16, 27, 878], tvGenreIds: [16, 10765] },
      { chip: 'Family bond', patterns: [/ოჯახ|მამა|დედა|შვილ|ძმა|და|მშობელ|ბავშვ|family|father|mother|child|brother|sister|parent|daughter|son/], terms: ['family', 'parents', 'children', 'siblings', 'brothers', 'emotional bond'], queries: ['family emotional story', 'parents children drama', 'siblings adventure'], movieGenreIds: [18, 10751], tvGenreIds: [18, 10751] },
      { chip: 'Hidden identity', patterns: [/საიდუმლო|იმალებ|ფარულ|იდენტობ|ვერავინ იცის|secret|hidden|identity|undercover|disguise|double life/], terms: ['secret', 'hidden identity', 'undercover', 'double life', 'disguise', 'truth revealed'], queries: ['hidden identity secret', 'undercover double life', 'secret truth revealed'], movieGenreIds: [53, 9648, 35], tvGenreIds: [9648, 80] },
      { chip: 'Dream ambition', patterns: [/ოცნებ|უნდა გახდეს|ცდილობს გახდეს|მიზან|ამბიცი|talent|dream|ambition|wants to become|tries to become|goal/], terms: ['dream', 'ambition', 'talent', 'goal', 'mentor', 'prove themselves'], queries: ['dream talent ambition', 'prove themselves mentor', 'wants to become'], movieGenreIds: [18, 35, 10751], tvGenreIds: [18] },
      { chip: 'Food story', patterns: [/საჭმელ|ამზად|მზარეულ|რესტორან|სამზარეულ|შეფ|კულინარ|food|cook|cooking|chef|restaurant|kitchen|culinary/], terms: ['food', 'cook', 'cooking', 'chef', 'restaurant', 'kitchen', 'culinary', 'service'], queries: ['chef restaurant cooking', 'food kitchen story', 'culinary dream'], movieGenreIds: [18, 35, 10751], tvGenreIds: [18] },
      { chip: 'Investigation', patterns: [/გამოძი|პოულობს|ეძებს|დეტექტივ|საქმე|დანაშაულ|მკვლელ|საიდუმლო|investigat|detective|case|crime|murder|killer|mystery|finds|searches/], terms: ['investigation', 'detective', 'case', 'crime', 'mystery', 'search', 'clues', 'truth'], queries: ['detective investigation mystery', 'crime case clues', 'search for truth'], movieGenreIds: [80, 9648, 53], tvGenreIds: [80, 9648] },
      { chip: 'Escape survival', patterns: [/გაქცევ|გადარჩენ|ხაფანგ|დაკარგ|მარტო|საფრთხ|escape|survive|survival|trapped|lost|stranded|danger/], terms: ['escape', 'survival', 'trapped', 'danger', 'lost', 'stranded', 'rescue'], queries: ['escape survival trapped', 'stranded danger rescue', 'lost survival story'], movieGenreIds: [53, 12, 18], tvGenreIds: [18, 9648] },
      { chip: 'Love conflict', patterns: [/სიყვარულ|შეყვარ|წყვილ|ქორწილ|დაშორ|love|romance|couple|relationship|wedding|heartbreak/], terms: ['love', 'romance', 'couple', 'relationship', 'wedding', 'heartbreak'], queries: ['romance relationship conflict', 'love story couple', 'wedding heartbreak'], movieGenreIds: [10749, 18, 35], tvGenreIds: [18] },
      { chip: 'Power magic', patterns: [/მაგი|ჯადოქ|წყევლ|ძალა|ზებუნებრივ|superpower|power|magic|witch|spell|curse|supernatural/], terms: ['magic', 'powers', 'curse', 'witch', 'spell', 'supernatural', 'fantasy'], queries: ['magic powers curse', 'supernatural fantasy story', 'witch spell'], movieGenreIds: [14, 27, 878], tvGenreIds: [10765] },
      { chip: 'Future tech', patterns: [/რობოტ|ტექნოლოგ|მომავალ|ხელოვნურ|კოსმოს|ვირტუალურ|robot|technology|future|ai|artificial intelligence|virtual|space/], terms: ['technology', 'future', 'robot', 'artificial intelligence', 'virtual reality', 'science fiction'], queries: ['future technology sci fi', 'artificial intelligence robot', 'virtual reality story'], movieGenreIds: [878], tvGenreIds: [10765] },
      { chip: 'Revenge justice', patterns: [/შურისძი|სამაგიერო|ღალატ|სამართალ|revenge|vengeance|betrayal|justice|payback/], terms: ['revenge', 'vengeance', 'betrayal', 'justice', 'payback'], queries: ['revenge betrayal justice', 'vengeance payback', 'justice thriller'], movieGenreIds: [28, 53, 80], tvGenreIds: [80, 18] },
      { chip: 'Competition', patterns: [/შეჯიბრ|თამაშ|ტურნირ|გამარჯვ|სპორტ|competition|game|tournament|contest|win|championship|sport/], terms: ['competition', 'game', 'tournament', 'contest', 'championship', 'win'], queries: ['competition tournament story', 'contest championship', 'game to win'], movieGenreIds: [18, 35, 53], tvGenreIds: [18, 10764] },
      { chip: 'School youth', patterns: [/სკოლ|მოსწავლ|სტუდენტ|თინეიჯ|უნივერსიტეტ|school|student|teen|college|coming of age/], terms: ['school', 'student', 'teen', 'college', 'coming of age', 'friends'], queries: ['teen school coming of age', 'student college story', 'high school friends'], movieGenreIds: [18, 35, 10751], tvGenreIds: [18] },
      { chip: 'Journey quest', patterns: [/მოგზაურ|გზა|მისია|ძებნა|თავგადასავალ|განძ|journey|road|mission|quest|adventure|treasure/], terms: ['journey', 'mission', 'quest', 'adventure', 'road trip', 'treasure'], queries: ['journey quest adventure', 'mission road trip', 'treasure adventure'], movieGenreIds: [12, 28, 14], tvGenreIds: [10759] },
    ];

    return concepts
      .filter((concept) => concept.patterns.some((pattern) => pattern.test(normalized)))
      .map(({ chip, terms, queries, movieGenreIds, tvGenreIds }) => ({ chip, terms, queries, movieGenreIds, tvGenreIds }));
  }

  private localizedScenarioExpansions(normalized: string): Array<{
    chip: string;
    terms: string[];
    queries: string[];
    movieGenreIds?: number[];
    tvGenreIds?: number[];
  }> {
    const matches: Array<{
      chip: string;
      terms: string[];
      queries: string[];
      movieGenreIds?: number[];
      tvGenreIds?: number[];
    }> = [];
    const has = (...patterns: RegExp[]) => patterns.some((pattern) => pattern.test(normalized));

    if (
      has(/ძმა|ძმები|და-ძმა|ოჯახ/, /brother|brothers|sibling|family/) &&
      has(/მოჩვენ|სული|დემონ|ზებუნებრივ|პარანორმალ/, /ghost|spirit|demon|supernatural|paranormal/) &&
      has(/ნადირ|ეძებ|ებრძოლ|გამოიძი/, /hunt|search|fight|investigat/)
    ) {
      matches.push({
        chip: 'Supernatural case',
        terms: ['supernatural', 'paranormal', 'brothers', 'siblings', 'hunters', 'hunt', 'ghosts', 'spirits', 'demons', 'monster', 'case', 'family', 'sam', 'dean', 'winchester'],
        queries: ['supernatural', 'brothers hunt ghosts', 'brothers hunt demons', 'sam dean winchester', 'paranormal hunters brothers'],
        movieGenreIds: [27, 14, 9648],
        tvGenreIds: [10765, 9648, 18],
      });
    }

    if (
      has(/ერთიდაიგივე|ერთი და იგივე|იგივე დღე|იმავე დღე|ერთ დღეს|დროის მარყუჟ|დროის ციკლ|ბევრჯერ|ისევ და ისევ/, /same day|time loop|repeat|again and again|over and over|reliv/) &&
      has(/გადის|იღვიძებს|ცხოვრობს|მეორდება|განმეორ/, /repeat|reliv|wake|stuck/)
    ) {
      matches.push({
        chip: 'Time loop',
        terms: ['time loop', 'same day', 'repeating day', 'reliving same day', 'stuck in time', 'loop', 'repeat', 'again and again', 'deja vu'],
        queries: ['groundhog day', 'time loop', 'same day over and over', 'reliving the same day', 'stuck in a time loop'],
        movieGenreIds: [35, 14, 878],
        tvGenreIds: [10765, 9648],
      });
    }

    if (has(/დედამიწის დასასრული|აპოკალიფს|ვირუს|ინფექც|ზომბ|გადარჩენ/, /apocalypse|virus|infection|zombie|surviv/)) {
      matches.push({
        chip: 'Survival threat',
        terms: ['apocalypse', 'survival', 'virus', 'infection', 'outbreak', 'zombie', 'undead', 'last survivors', 'danger', 'collapse'],
        queries: ['apocalypse survival', 'virus outbreak survival', 'zombie infection', 'last survivors'],
        movieGenreIds: [27, 53, 878],
        tvGenreIds: [10765, 18, 9648],
      });
    }

    if (has(/დეტექტივ|გამოძი|მკვლელ|დანაშაულ|საქმე|პოლიცი/, /detective|investigat|murder|crime|case|police/)) {
      matches.push({
        chip: 'Investigation',
        terms: ['detective', 'investigation', 'murder', 'killer', 'case', 'crime', 'police', 'mystery', 'hidden truth'],
        queries: ['detective murder investigation', 'crime mystery case', 'police investigation killer'],
        movieGenreIds: [80, 9648, 53],
        tvGenreIds: [80, 9648],
      });
    }

    if (has(/კოსმოს|მარს|პლანეტ|ასტრონავტ|უცხოპლანეტ/, /space|mars|planet|astronaut|alien/)) {
      matches.push({
        chip: 'Space mission',
        terms: ['space', 'mars', 'planet', 'astronaut', 'alien', 'galaxy', 'mission', 'stranded', 'survival'],
        queries: ['space survival astronaut', 'stranded on mars', 'alien planet mission'],
        movieGenreIds: [878, 12],
        tvGenreIds: [10765],
      });
    }

    if (has(/ციხე|პატიმ|გაქცევ|უსამართლოდ/, /prison|jail|escape|wrongly imprisoned/)) {
      matches.push({
        chip: 'Prison escape',
        terms: ['prison', 'jail', 'escape', 'wrongly imprisoned', 'fugitive', 'plan', 'brother', 'rescue'],
        queries: ['prison escape', 'wrongly imprisoned escape', 'jail break thriller'],
        movieGenreIds: [53, 80],
        tvGenreIds: [80, 18],
      });
    }

    if (has(/რობოტ|ხელოვნურ ინტელექტ|ანდროიდ|ტექნოლოგ|მომავალ/, /robot|android|artificial intelligence|technology|future/)) {
      matches.push({
        chip: 'AI story',
        terms: ['robot', 'android', 'artificial intelligence', 'technology', 'future', 'experiment', 'science fiction'],
        queries: ['artificial intelligence robot', 'android future technology', 'science fiction experiment'],
        movieGenreIds: [878],
        tvGenreIds: [10765],
      });
    }

    if (
      has(/ვირთხ|თაგვ|ცხოველ|პატარა არსება|rat|mouse|animal/) &&
      has(/მზარეულ|საჭმელ|ამზად|რესტორან|სამზარეულ|კულინარ|შეფ|cook|cooking|chef|restaurant|kitchen|food/)
    ) {
      matches.push({
        chip: 'Animal chef',
        terms: ['rat', 'mouse', 'animal', 'chef', 'cook', 'cooking', 'restaurant', 'kitchen', 'food', 'paris', 'animation', 'secret talent', 'dream', 'unlikely hero'],
        queries: ['ratatouille', 'rat chef restaurant', 'mouse cooking restaurant', 'animated chef kitchen', 'animal chef cooking'],
        movieGenreIds: [16, 35, 10751],
        tvGenreIds: [16, 10762],
      });
    }

    if (has(/მზარეულ|საჭმელ|ამზად|რესტორან|სამზარეულ|კულინარ|შეფ|cook|cooking|chef|restaurant|kitchen|food/)) {
      matches.push({
        chip: 'Cooking story',
        terms: ['chef', 'cook', 'cooking', 'restaurant', 'kitchen', 'food', 'culinary', 'recipe', 'service', 'dream', 'mentor'],
        queries: ['chef restaurant cooking', 'kitchen food story', 'cooking dream restaurant'],
        movieGenreIds: [35, 18],
        tvGenreIds: [18],
      });
    }

    if (has(/ანიმაც|ანიმე|მულტფილმ|cartoon|anime|animation/, /animation|anime|cartoon/)) {
      matches.push({
        chip: 'Animation',
        terms: ['animation', 'anime', 'cartoon', 'animated', 'family', 'adventure', 'imagination', 'characters'],
        queries: ['animation adventure', 'anime series', 'animated movie', 'cartoon family adventure'],
        movieGenreIds: [16],
        tvGenreIds: [16],
      });
    }

    return matches;
  }

  private fallbackScenarioGroups(terms: string[]): string[][] {
    const normalizedTerms = terms.map((term) => this.stemScenarioToken(term.toLowerCase())).filter((term) => term.length > 2);
    const actionGroup = normalizedTerms.filter((term) => this.isActionToken(term));
    const objectGroup = normalizedTerms.filter((term) => !this.isActionToken(term));
    const phraseGroups = [...this.ngrams(normalizedTerms, 2), ...this.ngrams(normalizedTerms, 3)]
      .slice(0, 8)
      .map((phrase) => phrase.split(' '));

    return [
      actionGroup.slice(0, 12),
      objectGroup.slice(0, 16),
      ...phraseGroups,
    ].filter((group) => group.length > 0);
  }

  private buildSearchQueries(terms: string[], chips: string[], normalized = ''): string[] {
    const important = terms.filter((term) => /^[a-z0-9- ]+$/i.test(term));
    const queries = [
      important.slice(0, 5).join(' '),
      important.slice(0, 3).join(' '),
      chips.join(' '),
      important
        .filter((term) =>
          [
            'space',
            'mars',
            'astronaut',
            'survival',
            'detective',
            'mystery',
            'robot',
            'alien',
            'love',
            'war',
            'supernatural',
            'brothers',
            'hunter',
            'hunters',
            'ghost',
            'ghosts',
            'demon',
            'demons',
          ].includes(term),
        )
        .join(' '),
    ];

    if (important.includes('mars') || (important.includes('astronaut') && important.includes('survival'))) {
      queries.unshift('mars astronaut survival', 'stranded on mars', 'space survival astronaut');
    }

    if (important.includes('detective') || important.includes('murder') || important.includes('investigation')) {
      queries.unshift('detective murder investigation', 'crime mystery detective');
    }

    if (important.includes('robot') || important.includes('artificial intelligence') || important.includes('ai')) {
      queries.unshift('artificial intelligence robot', 'robot future technology');
    }

    if (this.hasSupernaturalIntent(important)) {
      queries.unshift('supernatural', 'brothers hunt ghosts', 'two brothers hunt ghosts', 'brothers hunt demons', 'ghost hunters brothers', 'sam dean winchester');
    }

    if (this.hasTimeLoopIntent(important, normalized)) {
      queries.unshift('groundhog day', 'time loop', 'same day over and over', 'reliving the same day', 'stuck in a time loop');
    }

    this.semanticRules.forEach((rule) => {
      if (rule.terms.some((term) => important.includes(term)) || rule.words.some((word) => normalized.includes(word))) {
        queries.unshift(...rule.queries);
      }
    });

    return [...new Set(queries.map((query) => query.trim()).filter((query) => query.length >= 3))];
  }

  private rank(items: MediaItem[], profile: TextProfile): MediaItem[] {
    const terms = new Set(profile.expandedTerms.map((term) => term.toLowerCase()));
    const queryTerms = [...terms].filter((term) => term.length >= 3);
    const priorityTerms = profile.priorityTerms.map((term) => term.toLowerCase()).filter((term) => term.length >= 3);
    const semanticGroups = profile.semanticGroups.map((group) => group.map((term) => term.toLowerCase()).filter((term) => term.length >= 3));
    const allGenreIds = [...profile.movieGenreIds, ...profile.tvGenreIds];
    const weightedQueryTerms = [...new Set([...priorityTerms, ...profile.terms.map((term) => term.toLowerCase()).filter((term) => term.length >= 3)])];
    return [...items]
      .map((item) => {
        const hiddenPlot = item.hiddenPlot || `${item.title} ${item.originalTitle} ${item.description} ${item.genres.join(' ')}`.toLowerCase();
        const titleText = `${item.title} ${item.originalTitle}`.toLowerCase();
        const primaryTitle = item.title.toLowerCase().trim();
        const plotOnly = this.withoutTitleNoise(hiddenPlot, titleText);
        const scenario = this.scenarioSimilarity(profile, titleText, plotOnly, semanticGroups);
        const intentAdjustment = this.intentAdjustment(profile, plotOnly);
        const nameMatch = this.nameMatchScore(profile, `${titleText} ${hiddenPlot}`);
        const matchedTerms = queryTerms.filter((term) => titleText.includes(term) || hiddenPlot.includes(term));
        const priorityMatches = priorityTerms.filter((term) => titleText.includes(term) || hiddenPlot.includes(term));
        const weightedMatches = weightedQueryTerms.filter((term) => titleText.includes(term) || hiddenPlot.includes(term));
        const coveredGroups = this.semanticGroupCoverage(semanticGroups, `${titleText} ${hiddenPlot}`);
        const groupCoverageRatio = semanticGroups.length ? coveredGroups / semanticGroups.length : 0;
        const matchRatio = queryTerms.length ? matchedTerms.length / queryTerms.length : 0;
        const priorityRatio = priorityTerms.length ? priorityMatches.length / priorityTerms.length : 0;
        const weightedRatio = weightedQueryTerms.length ? weightedMatches.length / weightedQueryTerms.length : matchRatio;
        const semanticPercent = scenario.percent;
        const strongPlotMatch = matchRatio >= 0.6;
        const termScore = [...terms].reduce((score, term) => {
          if (!term || term.length < 3) return score;
          if (titleText.includes(term)) return score + 14;
          if (hiddenPlot.includes(term)) return score + 7;
          return score;
        }, 0);
        const exactTitleBoost = profile.terms.some((term) => term.length > 4 && titleText.includes(term)) && scenario.percent >= 45 ? 30 : 0;
        const genreScore = item.genreIds.filter((id) => allGenreIds.includes(id)).length * 3;
        const matchScore = strongPlotMatch ? 120 + matchedTerms.length * 8 : matchedTerms.length * 4;
        const priorityScore = priorityRatio >= 0.6 ? 160 + priorityMatches.length * 14 : priorityMatches.length * 10;
        const groupScore = semanticGroups.length ? coveredGroups * 90 + groupCoverageRatio * 120 : 0;
        const groupPenalty = semanticGroups.length > 1 && groupCoverageRatio < 0.5 ? -120 : 0;
        const semanticThresholdScore = priorityTerms.length >= 3 && priorityRatio >= 0.6 ? 220 : 0;
        const exactQueryBoost = profile.searchQueries.some((query) => query.length > 4 && titleText.includes(query.toLowerCase())) && scenario.percent >= 50 ? 80 : 0;
        const canonicalQueries = [...profile.searchQueries, ...this.scenarioPhraseQueries(profile), ...this.storySignatureQueries(profile), ...this.conceptSeedQueries(profile)].map((query) => query.toLowerCase().trim());
        const exactCanonicalBoost = canonicalQueries.some((query) => primaryTitle === query) ? { percent: 14, score: 3200 } : { percent: 0, score: 0 };
        const phraseTitleBoost = canonicalQueries.some((query) => query.length >= 8 && (titleText.includes(query) || query.includes(primaryTitle))) ? { percent: 8, score: 1200 } : { percent: 0, score: 0 };
        const recognizedTitleBoost = this.recognizedTitleBoost(profile, primaryTitle);
        const evidencePenalty = this.plotEvidencePenalty(scenario.evidenceRatio, scenario.groupRatio, scenario.phraseRatio, priorityRatio);
        const evidenceBoost = scenario.evidenceRatio >= 0.72 ? { percent: 8, score: 900 } : scenario.evidenceRatio >= 0.58 ? { percent: 4, score: 420 } : { percent: 0, score: 0 };
        const conceptMismatch = this.conceptMismatchPenalty(profile, plotOnly);
        const ratingScore = Math.max(0, item.rating) * 1.4;
        const popularityScore = Math.min(item.popularity / 80, 10);
        const voteScore = Math.min(item.voteCount / 1000, 8);
        const score =
          scenario.score +
          intentAdjustment.score +
          exactCanonicalBoost.score +
          phraseTitleBoost.score +
          recognizedTitleBoost.score +
          evidenceBoost.score +
          conceptMismatch.score +
          nameMatch.score +
          exactQueryBoost * 0.65 +
          exactTitleBoost +
          semanticThresholdScore +
          priorityScore +
          groupScore +
          groupPenalty +
          evidencePenalty.score +
          matchScore +
          termScore +
          genreScore +
          ratingScore +
          popularityScore +
          voteScore;
        const titleOnlyPenalty = scenario.groupRatio < 0.35 && scenario.phraseRatio < 0.2 && titleText.split(/\s+/).length <= 3 ? 14 : 0;
        const finalPercent = Math.max(
          0,
          Math.min(
            100,
            Math.max(semanticPercent, nameMatch.percent) +
              intentAdjustment.percent +
              exactCanonicalBoost.percent +
              phraseTitleBoost.percent +
              recognizedTitleBoost.percent +
              evidenceBoost.percent +
              evidencePenalty.percent -
              conceptMismatch.percent -
              titleOnlyPenalty,
          ),
        );
        return {
          item: { ...item, matchPercent: finalPercent },
          matchPercent: finalPercent,
          groupCoverageRatio: scenario.groupRatio,
          priorityRatio: scenario.phraseRatio,
          score,
        };
      })
      .filter(({ score }) => score > 4)
      .sort((a, b) => {
        if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
        if (b.groupCoverageRatio !== a.groupCoverageRatio) return b.groupCoverageRatio - a.groupCoverageRatio;
        if (b.priorityRatio !== a.priorityRatio) return b.priorityRatio - a.priorityRatio;
        return b.score - a.score;
      })
      .map(({ item }) => item);
  }

  private withoutTitleNoise(plotText: string, titleText: string): string {
    const titleParts = titleText
      .split(/\s+/)
      .map((part) => part.replace(/[^\p{L}\p{N}-]/gu, '').trim())
      .filter((part) => part.length >= 4);

    let cleaned = plotText;
    [...new Set(titleParts)].forEach((part) => {
      const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
    });
    return cleaned.replace(/\s+/g, ' ').trim();
  }

  private plotEvidencePenalty(evidenceRatio: number, groupRatio: number, phraseRatio: number, priorityRatio: number): { percent: number; score: number } {
    if (evidenceRatio >= 0.42 || priorityRatio >= 0.55) {
      return { percent: 0, score: 0 };
    }

    if (groupRatio < 0.25 && phraseRatio < 0.15) {
      return { percent: -18, score: -950 };
    }

    if (evidenceRatio < 0.28) {
      return { percent: -10, score: -520 };
    }

    return { percent: -5, score: -240 };
  }

  private recognizedTitleBoost(profile: TextProfile, primaryTitle: string): { percent: number; score: number } {
    const concepts = this.scenarioConceptFingerprints(`${profile.original} ${profile.priorityTerms.join(' ')} ${profile.searchQueries.join(' ')}`);
    const title = primaryTitle.toLowerCase().trim();
    const boosts: Array<[string, RegExp]> = [
      ['animal-chef', /^ratatouille$/],
      ['supernatural-hunters', /^supernatural$/],
      ['time-loop', /^groundhog day$/],
      ['living-toys', /^toy story$/],
      ['ocean-fish', /^finding nemo$/],
      ['racing-cars', /^cars$/],
      ['royal-animal-kingdom', /^the lion king$/],
      ['ogre-fairytale', /^shrek$/],
      ['inside-mind-emotions', /^inside out$/],
      ['afterlife-family', /^coco$/],
      ['wizard-school', /^harry potter/],
      ['ring-quest', /^the lord of the rings/],
      ['dragon-viking', /^how to train your dragon$/],
      ['future-robot', /^wall-?e$/],
      ['simulation-reality', /^the matrix$/],
      ['dinosaur-park', /^jurassic park$/],
      ['shark-attack', /^jaws$/],
      ['sinking-ship-romance', /^titanic$/],
      ['home-alone-burglars', /^home alone$/],
      ['alien-child-friendship', /^e\.?t\.? the extra-terrestrial$/],
      ['flying-house-adventure', /^up$/],
      ['pirate-treasure', /^pirates of the caribbean/],
    ];

    return boosts.some(([concept, pattern]) => concepts.has(concept) && pattern.test(title))
      ? { percent: 28, score: 12000 }
      : { percent: 0, score: 0 };
  }

  private conceptMismatchPenalty(profile: TextProfile, plotText: string): { percent: number; score: number } {
    const queryConcepts = this.scenarioConceptFingerprints(`${profile.original} ${profile.priorityTerms.join(' ')} ${profile.searchQueries.join(' ')}`);
    if (!queryConcepts.size) {
      return { percent: 0, score: 0 };
    }

    const plotConcepts = this.scenarioConceptFingerprints(plotText);
    const directHits = [...queryConcepts].filter((concept) => plotConcepts.has(concept)).length;
    if (directHits > 0) {
      return { percent: 0, score: 0 };
    }

    const bridgeRatio = this.scenarioConceptBridges(queryConcepts, plotConcepts);
    if (bridgeRatio >= 0.5) {
      return { percent: 0, score: 0 };
    }

    if (queryConcepts.size >= 2) {
      return { percent: 18, score: -1100 };
    }

    return { percent: 9, score: -520 };
  }

  private intentAdjustment(profile: TextProfile, plotText: string): { percent: number; score: number } {
    const terms = profile.expandedTerms.map((term) => term.toLowerCase());

    if (this.hasTimeLoopIntent(terms, profile.original.toLowerCase())) {
      const strong = /time loop|temporal loop|same day|repeating day|over and over|again and again|reliv|stuck in time|deja vu|loop reliving|repeating the same/.test(plotText);
      const weak = /repeat|loop|same/.test(plotText);
      if (strong) {
        return { percent: 24, score: 1800 };
      }
      if (weak) {
        return { percent: -10, score: -450 };
      }
      return { percent: -34, score: -1400 };
    }

    if (this.hasSupernaturalIntent(terms)) {
      const strong = /brother|brothers|sibling|sam|dean|winchester/.test(plotText) && /ghost|spirit|demon|supernatural|paranormal|monster|hunter|hunt/.test(plotText);
      if (strong) {
        return { percent: 18, score: 1200 };
      }
    }

    if (terms.some((term) => ['rat', 'mouse', 'animal'].includes(term)) && terms.some((term) => ['chef', 'cook', 'cooking', 'restaurant', 'kitchen', 'food'].includes(term))) {
      const hasAnimal = /rat|mouse|animal|remy/.test(plotText);
      const hasCooking = /chef|cook|cooking|restaurant|kitchen|food|culinary|paris|gusteau|linguini/.test(plotText);
      const hasAnimation = /animation|animated|cartoon|family/.test(plotText);
      if (hasAnimal && hasCooking) {
        return { percent: hasAnimation ? 22 : 16, score: hasAnimation ? 1900 : 1300 };
      }
      if (hasCooking && !hasAnimal) {
        return { percent: -8, score: -350 };
      }
    }

    return { percent: 0, score: 0 };
  }

  private scenarioSimilarity(
    profile: TextProfile,
    titleText: string,
    hiddenPlot: string,
    semanticGroups: string[][],
  ): { percent: number; score: number; groupRatio: number; phraseRatio: number; evidenceRatio: number } {
    const originalQueryText = profile.original;
    const queryText = `${profile.original} ${profile.priorityTerms.join(' ')} ${profile.semanticGroups.flat().join(' ')}`;
    const plotText = hiddenPlot;
    const originalTokens = this.scenarioTokens(originalQueryText).slice(0, 80);
    const queryTokens = this.scenarioTokens(queryText).slice(0, 120);
    const plotTokensList = this.scenarioTokens(plotText);
    const plotTokens = new Set(plotTokensList);

    if (!queryTokens.length || !plotTokens.size) {
      return { percent: 0, score: 0, groupRatio: 0, phraseRatio: 0, evidenceRatio: 0 };
    }

    const matchedTokens = queryTokens.filter((token) => this.tokenAppears(token, plotTokens));
    const tokenRatio = matchedTokens.length / queryTokens.length;
    const originalMatches = originalTokens.filter((token) => this.tokenAppears(token, plotTokens));
    const originalRatio = originalTokens.length ? originalMatches.length / originalTokens.length : tokenRatio;
    const cosineRatio = this.cosineSimilarity(queryTokens, plotTokensList);
    const jaccardRatio = this.jaccardSimilarity(queryTokens, plotTokensList);
    const orderedRatio = this.orderedSimilarity(queryTokens, plotTokensList);
    const actionTokens = queryTokens.filter((token) => this.isActionToken(token));
    const objectTokens = queryTokens.filter((token) => !this.isActionToken(token));
    const actionRatio = actionTokens.length ? actionTokens.filter((token) => this.tokenAppears(token, plotTokens)).length / actionTokens.length : tokenRatio;
    const objectRatio = objectTokens.length ? objectTokens.filter((token) => this.tokenAppears(token, plotTokens)).length / objectTokens.length : tokenRatio;
    const proximityRatio = this.proximitySimilarity(actionTokens, objectTokens, plotTokensList);
    const distinctiveRatio = this.distinctiveCoverage(queryTokens, plotTokens);
    const coreRatio = this.coreConceptCoverage(profile, plotText);
    const bestWindowRatio = this.bestWindowSimilarity(queryTokens, plotTokensList);
    const bundleWindowRatio = this.semanticBundleWindowCoverage(semanticGroups, plotTokensList);
    const groupPairRatio = this.semanticGroupPairCoverage(semanticGroups, plotTokensList);
    const sentenceRatio = this.sentenceLevelSimilarity(queryTokens, plotText);
    const anchorRatio = this.narrativeAnchorCoverage(profile, semanticGroups, plotTokensList);
    const sequenceRatio = this.storyBeatSequenceSimilarity(originalTokens.length ? originalTokens : queryTokens, plotTokensList);
    const lcsRatio = this.longestScenarioSubsequenceRatio(originalTokens.length ? originalTokens : queryTokens, plotTokensList);
    const rarePhraseRatio = this.rarePhraseSimilarity(originalTokens.length ? originalTokens : queryTokens, plotTokensList);
    const conceptFingerprintRatio = this.scenarioConceptFingerprintSimilarity(
      `${profile.original} ${profile.priorityTerms.join(' ')} ${profile.searchQueries.join(' ')}`,
      plotText,
    );
    const chunkWindowRatio = this.chunkWindowScenarioSimilarity(originalTokens.length ? originalTokens : queryTokens, plotTokensList);
    const triadRatio = this.narrativeTriadSimilarity(originalTokens.length ? originalTokens : queryTokens, plotTokensList);
    const bm25Ratio = this.bm25LikeSimilarity(queryTokens, plotTokensList);

    const queryBigrams = this.ngrams(queryTokens, 2);
    const queryTrigrams = this.ngrams(queryTokens, 3);
    const plotBigrams = new Set(this.ngrams(plotTokensList, 2));
    const plotTrigrams = new Set(this.ngrams(plotTokensList, 3));
    const phraseTotal = queryBigrams.length + queryTrigrams.length;
    const phraseMatches =
      queryBigrams.filter((phrase) => plotBigrams.has(phrase)).length +
      queryTrigrams.filter((phrase) => plotTrigrams.has(phrase)).length;
    const phraseRatio = phraseTotal ? phraseMatches / phraseTotal : tokenRatio;

    const coveredGroups = this.semanticGroupCoverage(semanticGroups, plotText);
    const groupRatio = semanticGroups.length ? coveredGroups / semanticGroups.length : tokenRatio;

    const titleRatio = queryTokens.filter((token) => titleText.includes(token)).length / queryTokens.length;
    const fuzzyRatio = matchedTokens.filter((token) => !plotTokens.has(token)).length / queryTokens.length;
    const beatRatio = actionRatio * 0.55 + objectRatio * 0.45;
    const evidenceRatio = Math.max(
      originalRatio,
      phraseRatio,
      groupRatio,
      proximityRatio,
      coreRatio,
      bestWindowRatio,
      bundleWindowRatio,
      groupPairRatio,
      sentenceRatio,
      sequenceRatio,
      lcsRatio,
      rarePhraseRatio,
      conceptFingerprintRatio,
      chunkWindowRatio,
    );
    const percent = Math.round(
      Math.min(
        100,
        Math.max(
          0,
          (
            originalRatio * 0.22 +
            tokenRatio * 0.14 +
            phraseRatio * 0.16 +
            groupRatio * 0.14 +
            beatRatio * 0.12 +
            proximityRatio * 0.11 +
            distinctiveRatio * 0.08 +
            coreRatio * 0.1 +
            bestWindowRatio * 0.12 +
            bundleWindowRatio * 0.1 +
            groupPairRatio * 0.09 +
            sentenceRatio * 0.11 +
            anchorRatio * 0.08 +
            sequenceRatio * 0.09 +
            lcsRatio * 0.09 +
            rarePhraseRatio * 0.1 +
            conceptFingerprintRatio * 0.11 +
            chunkWindowRatio * 0.1 +
            triadRatio * 0.1 +
            bm25Ratio * 0.08 +
            cosineRatio * 0.07 +
            jaccardRatio * 0.04 +
            orderedRatio * 0.03 +
            titleRatio * 0.01 +
            fuzzyRatio * 0.01
          ) * 100,
        ),
      ),
    );

    return {
      percent,
      score:
        percent * 24 +
        phraseMatches * 24 +
        matchedTokens.length * 11 +
        originalMatches.length * 18 +
        coveredGroups * 95 +
        beatRatio * 280 +
        proximityRatio * 320 +
        distinctiveRatio * 260 +
        coreRatio * 520 +
        bestWindowRatio * 620 +
        bundleWindowRatio * 680 +
        groupPairRatio * 620 +
        sentenceRatio * 740 +
        anchorRatio * 560 +
        sequenceRatio * 650 +
        lcsRatio * 700 +
        rarePhraseRatio * 780 +
        conceptFingerprintRatio * 820 +
        chunkWindowRatio * 760 +
        triadRatio * 780 +
        bm25Ratio * 460 +
        cosineRatio * 260 +
        orderedRatio * 220,
      groupRatio,
      phraseRatio,
      evidenceRatio,
    };
  }

  private cosineSimilarity(queryTokens: string[], plotTokens: string[]): number {
    const queryVector = this.termFrequency(queryTokens);
    const plotVector = this.termFrequency(plotTokens);
    let dot = 0;
    let queryMagnitude = 0;
    let plotMagnitude = 0;

    queryVector.forEach((value, token) => {
      dot += value * (plotVector.get(token) ?? 0);
      queryMagnitude += value * value;
    });
    plotVector.forEach((value) => {
      plotMagnitude += value * value;
    });

    if (!queryMagnitude || !plotMagnitude) {
      return 0;
    }
    return dot / (Math.sqrt(queryMagnitude) * Math.sqrt(plotMagnitude));
  }

  private bestWindowSimilarity(queryTokens: string[], plotTokens: string[]): number {
    if (!queryTokens.length || !plotTokens.length) {
      return 0;
    }

    const querySet = new Set(queryTokens);
    const windowSize = Math.min(90, Math.max(24, queryTokens.length * 5));
    const step = Math.max(6, Math.floor(windowSize / 3));
    let best = 0;

    for (let start = 0; start < plotTokens.length; start += step) {
      const windowTokens = plotTokens.slice(start, start + windowSize);
      const windowSet = new Set(windowTokens);
      const hits = [...querySet].filter((token) => this.tokenAppears(token, windowSet)).length;
      const ratio = hits / querySet.size;
      if (ratio > best) {
        best = ratio;
      }
      if (start + windowSize >= plotTokens.length) {
        break;
      }
    }

    return best;
  }

  private semanticBundleWindowCoverage(semanticGroups: string[][], plotTokens: string[]): number {
    const groups = semanticGroups
      .map((group) => [...new Set(group.flatMap((term) => this.scenarioTokens(term)).filter((token) => token.length >= 3))])
      .filter((group) => group.length > 0)
      .slice(0, 10);

    if (!groups.length || !plotTokens.length) {
      return 0;
    }

    const windowSize = 110;
    const step = 30;
    let best = 0;

    for (let start = 0; start < plotTokens.length; start += step) {
      const windowSet = new Set(plotTokens.slice(start, start + windowSize));
      const covered = groups.filter((group) => group.some((token) => this.tokenAppears(token, windowSet))).length;
      best = Math.max(best, covered / groups.length);
      if (start + windowSize >= plotTokens.length) {
        break;
      }
    }

    return best;
  }

  private semanticGroupCoverage(semanticGroups: string[][], text: string): number {
    if (!semanticGroups.length || !text.trim()) {
      return 0;
    }

    const textTokens = new Set(this.scenarioTokens(text));
    return semanticGroups.filter((group) => {
      const groupTokens = [...new Set(group.flatMap((term) => this.scenarioTokens(term)).filter((token) => token.length >= 3))];
      if (!groupTokens.length) {
        return false;
      }
      const hits = groupTokens.filter((token) => this.tokenAppears(token, textTokens)).length;
      return hits / groupTokens.length >= (groupTokens.length <= 2 ? 0.5 : 0.34);
    }).length;
  }

  private semanticGroupPairCoverage(semanticGroups: string[][], plotTokens: string[]): number {
    const groups = semanticGroups
      .map((group) => [...new Set(group.flatMap((term) => this.scenarioTokens(term)).filter((token) => token.length >= 3))])
      .filter((group) => group.length > 0)
      .slice(0, 10);

    if (groups.length < 2 || !plotTokens.length) {
      return 0;
    }

    const pairs: Array<[string[], string[]]> = [];
    for (let first = 0; first < groups.length; first += 1) {
      for (let second = first + 1; second < groups.length; second += 1) {
        pairs.push([groups[first], groups[second]]);
      }
    }

    const sampledPairs = pairs.slice(0, 30);
    const coveredPairs = new Set<number>();
    const windowSize = 120;
    const step = 35;

    for (let start = 0; start < plotTokens.length; start += step) {
      const windowSet = new Set(plotTokens.slice(start, start + windowSize));

      sampledPairs.forEach(([firstGroup, secondGroup], index) => {
        if (coveredPairs.has(index)) {
          return;
        }

        const firstHit = firstGroup.some((token) => this.tokenAppears(token, windowSet));
        const secondHit = secondGroup.some((token) => this.tokenAppears(token, windowSet));
        if (firstHit && secondHit) {
          coveredPairs.add(index);
        }
      });

      if (start + windowSize >= plotTokens.length) {
        break;
      }
    }

    return sampledPairs.length ? coveredPairs.size / sampledPairs.length : 0;
  }

  private sentenceLevelSimilarity(queryTokens: string[], plotText: string): number {
    if (!queryTokens.length || !plotText.trim()) {
      return 0;
    }

    const querySet = new Set(queryTokens);
    const sentences = plotText
      .split(/[.!?;:]+|\n+/)
      .map((sentence) => this.scenarioTokens(sentence))
      .filter((tokens) => tokens.length >= 4);

    if (!sentences.length) {
      return 0;
    }

    let best = 0;
    for (let index = 0; index < sentences.length; index += 1) {
      const segment = [
        ...(sentences[index - 1] ?? []),
        ...sentences[index],
        ...(sentences[index + 1] ?? []),
      ];
      const segmentSet = new Set(segment);
      const hits = [...querySet].filter((token) => this.tokenAppears(token, segmentSet));
      const distinctiveHits = hits.filter((token) => !this.isGenericScenarioTerm(token)).length;
      const ordered = this.orderedSimilarity(queryTokens, segment);
      const cosine = this.cosineSimilarity(queryTokens, segment);
      const ratio = hits.length / querySet.size;
      const distinctiveRatio = querySet.size ? distinctiveHits / querySet.size : 0;
      best = Math.max(best, ratio * 0.58 + ordered * 0.16 + cosine * 0.16 + distinctiveRatio * 0.1);
    }

    return Math.min(1, best);
  }

  private narrativeAnchorCoverage(profile: TextProfile, semanticGroups: string[][], plotTokens: string[]): number {
    if (!plotTokens.length) {
      return 0;
    }

    const anchors = [
      ...profile.priorityTerms,
      ...profile.terms.filter((term) => term.length >= 4),
      ...semanticGroups.map((group) => group[0]).filter(Boolean),
    ]
      .flatMap((term) => this.scenarioTokens(term))
      .filter((token) => token.length >= 3 && !this.isGenericScenarioTerm(token));

    const uniqueAnchors = [...new Set(anchors)].slice(0, 22);
    if (!uniqueAnchors.length) {
      return 0;
    }

    const plotSet = new Set(plotTokens);
    const presentAnchors = uniqueAnchors.filter((token) => this.tokenAppears(token, plotSet));
    const globalCoverage = presentAnchors.length / uniqueAnchors.length;

    let bestClusterCoverage = 0;
    const windowSize = 150;
    const step = 40;
    for (let start = 0; start < plotTokens.length; start += step) {
      const windowSet = new Set(plotTokens.slice(start, start + windowSize));
      const covered = uniqueAnchors.filter((token) => this.tokenAppears(token, windowSet)).length;
      bestClusterCoverage = Math.max(bestClusterCoverage, covered / uniqueAnchors.length);
      if (start + windowSize >= plotTokens.length) {
        break;
      }
    }

    return Math.min(1, globalCoverage * 0.42 + bestClusterCoverage * 0.58);
  }

  private bm25LikeSimilarity(queryTokens: string[], plotTokens: string[]): number {
    if (!queryTokens.length || !plotTokens.length) {
      return 0;
    }

    const query = [...new Set(queryTokens)];
    const plotFreq = this.termFrequency(plotTokens);
    const avgDocLength = 900;
    const k1 = 1.25;
    const b = 0.72;
    let score = 0;
    let maxScore = 0;

    query.forEach((token) => {
      const tf = plotFreq.get(token) ?? [...plotFreq.keys()].filter((plotToken) => token.length >= 5 && (plotToken.startsWith(token) || token.startsWith(plotToken))).reduce((sum, plotToken) => sum + (plotFreq.get(plotToken) ?? 0), 0);
      const rarity = this.isGenericScenarioTerm(token) ? 0.55 : token.length >= 8 ? 1.35 : 1;
      const normalizedTf = tf ? ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (plotTokens.length / avgDocLength)))) : 0;
      score += normalizedTf * rarity;
      maxScore += 1.9 * rarity;
    });

    return maxScore ? Math.min(1, score / maxScore) : 0;
  }

  private termFrequency(tokens: string[]): Map<string, number> {
    const vector = new Map<string, number>();
    tokens.forEach((token) => vector.set(token, (vector.get(token) ?? 0) + 1));
    return vector;
  }

  private coreConceptCoverage(profile: TextProfile, plotText: string): number {
    const coreTerms = [
      ...profile.priorityTerms,
      ...profile.semanticGroups.flat(),
      ...profile.terms,
    ]
      .map((term) => term.toLowerCase().trim())
      .filter((term) => term.length >= 4 && !this.isGenericScenarioTerm(term));

    const distinctive = [...new Set(coreTerms)]
      .sort((a, b) => b.length - a.length)
      .slice(0, 18);

    if (!distinctive.length) {
      return 0;
    }

    const hits = distinctive.filter((term) => plotText.includes(term) || this.scenarioTokens(term).some((token) => plotText.includes(token)));
    const exactPhraseHits = distinctive.filter((term) => term.includes(' ') && plotText.includes(term)).length;
    return Math.min(1, hits.length / distinctive.length + exactPhraseHits * 0.08);
  }

  private isGenericScenarioTerm(term: string): boolean {
    return new Set([
      'movie',
      'film',
      'series',
      'story',
      'person',
      'people',
      'world',
      'life',
      'young',
      'family',
      'man',
      'woman',
      'new',
      'old',
      'character',
      'characters',
    ]).has(term);
  }

  private jaccardSimilarity(queryTokens: string[], plotTokens: string[]): number {
    const query = new Set(queryTokens);
    const plot = new Set(plotTokens);
    const intersection = [...query].filter((token) => this.tokenAppears(token, plot)).length;
    const union = new Set([...query, ...plot]).size;
    return union ? intersection / union : 0;
  }

  private orderedSimilarity(queryTokens: string[], plotTokens: string[]): number {
    if (!queryTokens.length || !plotTokens.length) {
      return 0;
    }

    let queryIndex = 0;
    let matches = 0;
    for (const plotToken of plotTokens) {
      const queryToken = queryTokens[queryIndex];
      if (!queryToken) {
        break;
      }
      if (plotToken === queryToken || (queryToken.length >= 5 && (plotToken.startsWith(queryToken) || queryToken.startsWith(plotToken)))) {
        matches += 1;
        queryIndex += 1;
      }
    }
    return matches / queryTokens.length;
  }

  private storyBeatSequenceSimilarity(queryTokens: string[], plotTokens: string[]): number {
    const beats = [...new Set(queryTokens.filter((token) => token.length >= 4 && !this.isGenericScenarioTerm(token)))].slice(0, 18);
    if (beats.length < 2 || !plotTokens.length) {
      return 0;
    }

    const positions = beats.map((beat) => {
      const indexes: number[] = [];
      plotTokens.forEach((plotToken, index) => {
        if (plotToken === beat || (beat.length >= 5 && (plotToken.startsWith(beat) || beat.startsWith(plotToken)))) {
          indexes.push(index);
        }
      });
      return indexes.slice(0, 24);
    });

    const covered = positions.filter((indexes) => indexes.length).length;
    if (!covered) {
      return 0;
    }

    let orderedHits = 0;
    let cursor = -1;
    let spanStart = Number.POSITIVE_INFINITY;
    let spanEnd = 0;

    positions.forEach((indexes) => {
      const nextIndex = indexes.find((index) => index > cursor);
      if (nextIndex !== undefined) {
        orderedHits += 1;
        cursor = nextIndex;
        spanStart = Math.min(spanStart, nextIndex);
        spanEnd = Math.max(spanEnd, nextIndex);
      }
    });

    const coverageRatio = covered / beats.length;
    const orderedRatio = orderedHits / beats.length;
    const span = Number.isFinite(spanStart) ? spanEnd - spanStart + 1 : plotTokens.length;
    const compactRatio = Math.max(0, 1 - span / Math.max(80, beats.length * 42));

    return Math.min(1, coverageRatio * 0.42 + orderedRatio * 0.38 + compactRatio * 0.2);
  }

  private longestScenarioSubsequenceRatio(queryTokens: string[], plotTokens: string[]): number {
    const query = queryTokens.filter((token) => token.length >= 4 && !this.isGenericScenarioTerm(token)).slice(0, 42);
    const plot = plotTokens.filter((token) => token.length >= 4 && !this.isGenericScenarioTerm(token)).slice(0, 1600);
    if (query.length < 2 || !plot.length) {
      return 0;
    }

    let previous = new Array(plot.length + 1).fill(0);
    for (let queryIndex = 1; queryIndex <= query.length; queryIndex += 1) {
      const current = new Array(plot.length + 1).fill(0);
      for (let plotIndex = 1; plotIndex <= plot.length; plotIndex += 1) {
        const queryToken = query[queryIndex - 1];
        const plotToken = plot[plotIndex - 1];
        const isMatch = plotToken === queryToken || (queryToken.length >= 5 && (plotToken.startsWith(queryToken) || queryToken.startsWith(plotToken)));
        current[plotIndex] = isMatch
          ? previous[plotIndex - 1] + 1
          : Math.max(previous[plotIndex], current[plotIndex - 1]);
      }
      previous = current;
    }

    return Math.min(1, previous[plot.length] / query.length);
  }

  private rarePhraseSimilarity(queryTokens: string[], plotTokens: string[]): number {
    const cleanQuery = queryTokens.filter((token) => token.length >= 4 && !this.isGenericScenarioTerm(token));
    const cleanPlot = plotTokens.filter((token) => token.length >= 4 && !this.isGenericScenarioTerm(token));
    if (cleanQuery.length < 2 || cleanPlot.length < 2) {
      return 0;
    }

    const queryPhrases = [
      ...this.ngrams(cleanQuery, 2),
      ...this.ngrams(cleanQuery, 3),
      ...this.ngrams(cleanQuery, 4),
    ].filter((phrase) => phrase.split(' ').some((token) => token.length >= 6));
    const plotPhrases = new Set([
      ...this.ngrams(cleanPlot, 2),
      ...this.ngrams(cleanPlot, 3),
      ...this.ngrams(cleanPlot, 4),
    ]);

    if (!queryPhrases.length) {
      return 0;
    }

    const exactMatches = queryPhrases.filter((phrase) => plotPhrases.has(phrase)).length;
    const softMatches = queryPhrases.filter((phrase) => {
      if (plotPhrases.has(phrase)) {
        return false;
      }
      const tokens = phrase.split(' ');
      return cleanPlot.some((_, index) => {
        const window = new Set(cleanPlot.slice(index, index + tokens.length + 2));
        return tokens.filter((token) => this.tokenAppears(token, window)).length / tokens.length >= 0.75;
      });
    }).length;

    return Math.min(1, (exactMatches + softMatches * 0.65) / queryPhrases.length);
  }

  private scenarioConceptFingerprintSimilarity(queryText: string, plotText: string): number {
    const queryConcepts = this.scenarioConceptFingerprints(queryText);
    if (!queryConcepts.size) {
      return 0;
    }

    const plotConcepts = this.scenarioConceptFingerprints(plotText);
    const hits = [...queryConcepts].filter((concept) => plotConcepts.has(concept)).length;
    const directCoverage = hits / queryConcepts.size;
    const bridgeCoverage = this.scenarioConceptBridges(queryConcepts, plotConcepts);
    return Math.min(1, directCoverage * 0.72 + bridgeCoverage * 0.28);
  }

  private scenarioConceptFingerprints(text: string): Set<string> {
    const value = text.toLowerCase();
    const concepts: Array<[string, RegExp]> = [
      ['time-loop', /time loop|same day|repeating day|over and over|again and again|reliv|stuck in time|deja vu|loop|repeat|ერთიდაიგივე|ერთი და იგივე|იგივე დღეს|ბევრჯერ|განმეორ/],
      ['supernatural-hunters', /supernatural|paranormal|ghost|spirit|demon|monster|hunter|hunt|brother|sibling|winchester|მოჩვენ|სული|დემონ|ზებუნებრივ|ნადირ|ძმა/],
      ['animal-chef', /rat|mouse|animal|chef|cook|cooking|restaurant|kitchen|food|culinary|remy|linguini|ვირთხ|თაგვ|მზარეულ|შეფ|საჭმელ|სამზარეულ|რესტორან/],
      ['lost-child-parent', /lost child|missing child|father search|mother search|parent search|rescue child|lost son|lost daughter|დაკარგულ|ბავშვ|შვილ|მშობელ|მამა|დედა|ეძებ/],
      ['living-toys', /toy|toys|owner|come to life|woody|buzz|andy|სათამაშ|თოჯინ|ცოცხლდებ/],
      ['ocean-fish', /fish|ocean|sea|underwater|reef|aquarium|shark|marine|თევზ|ოკეან|ზღვა|წყალქვეშ|ზვიგენ/],
      ['racing-cars', /car|cars|race|racing|driver|road|radiator springs|lightning mcqueen|მანქან|რბოლ|მძღოლ|გზა/],
      ['royal-animal-kingdom', /lion|king|throne|prince|kingdom|jungle|simba|mufasa|ლომ|მეფ|ტახტ|სამეფ|ჯუნგლ/],
      ['ogre-fairytale', /ogre|swamp|princess|donkey|fairy tale|monster|shrek|ფრინცეს|ჭაობ|ურჩხულ|ზღაპ/],
      ['inside-mind-emotions', /emotion|memory|mind|inside head|joy|sadness|feelings|მეხსიერ|ემოც|გრძნობ|გონებ|თავში/],
      ['afterlife-family', /afterlife|dead|death|spirit|ancestor|family memory|coco|music|სიკვდილ|მკვდარ|სულ|წინაპარ|მეხსიერ|მუსიკ/],
      ['wizard-school', /wizard|magic school|hogwarts|spell|dark lord|chosen boy|voldemort|ჯადოქ|მაგი|ჰოგვარტ|ბნელი ლორდ|არჩეულ/],
      ['ring-quest', /ring|hobbit|fellowship|middle-earth|dark lord|sauron|quest|ბეჭედ|ჰობიტ|ფენტეზი მოგზაურ|ბოროტი მეფ/],
      ['dragon-viking', /dragon|viking|toothless|train dragon|creature companion|დრაკონ|ვიკინგ|წვრთნ|მეგობარ/],
      ['future-robot', /robot|android|artificial intelligence|future earth|spacecraft|wall-e|technology|რობოტ|ანდროიდ|ხელოვნურ|ტექნოლოგ|მომავალ/],
      ['simulation-reality', /simulation|fake reality|matrix|virtual reality|computer world|chosen one|სიმულაცი|ყალბი რეალ|მატრიც|ვირტუალურ/],
      ['dinosaur-park', /dinosaur|jurassic|theme park|genetic|island|creatures escape|დინოზავრ|პარკ|გენეტიკ|კუნძულ/],
      ['shark-attack', /shark|beach|ocean attack|summer town|killer shark|ზვიგენ|პლაჟ|სანაპირ|ზღვაში ესხმის/],
      ['sinking-ship-romance', /ship|iceberg|sinking|titanic|poor rich romance|atlantic|გემი|აისბერგ|ჩაძირვ|ღარიბ|მდიდარ|ტიტანიკ/],
      ['home-alone-burglars', /home alone|child home|burglars|defends house|family comedy|სახლში მარტო|ქურდ|იცავს სახლ/],
      ['alien-child-friendship', /alien stranded|child helps alien|go home|e\.?t\.?|extraterrestrial|უცხოპლანეტ|ბავშვი ეხმარება|სახლში დაბრუნ/],
      ['flying-house-adventure', /flying house|balloons|old man|scout child|up animated|ბუშტ|სახლი ფრინავ|მოხუც|სკაუტ/],
      ['pirate-treasure', /pirate|cursed treasure|caribbean|captain|ship|treasure map|მეკობრ|კარიბ|წყევლილ განძ|კაპიტან/],
      ['prison-escape', /prison|jail|escape from prison|wrongly imprisoned|jail break|ციხ|პატიმ|გაქცევ|უსამართლოდ/],
      ['heist-crew', /heist|robbery|bank robbery|thieves|crew plan|steal|rob|ძარცვ|ქურდ|ბანკ|გეგმა/],
      ['detective-murder', /detective|investigation|murder|killer|case|crime|clues|police|დეტექტივ|გამოძი|მკვლელ|საქმ|დანაშაულ|პოლიცი/],
      ['revenge-betrayal', /revenge|vengeance|betrayal|payback|justice|შურისძი|ღალატ|სამართალ|ანგარიშსწორ/],
      ['post-apocalypse', /apocalypse|post apocalyptic|virus|infection|zombie|last survivors|collapse|აპოკალიფს|ვირუს|ინფექც|ზომბ|გადარჩენ/],
      ['spy-mission', /spy|agent|undercover|secret mission|intelligence agency|ჯაშუშ|აგენტ|ფარულ|მისია|სპეცსამსახურ/],
      ['superhero-origin', /superhero|masked hero|gets powers|secret identity|villain|save city|სუპერგმირ|ნიღაბ|ძალა მიიღო|ბოროტმოქმედ/],
      ['school-coming-age', /school|student|teen|college|coming of age|friends|სკოლ|მოსწავლ|სტუდენტ|თინეიჯ|უნივერსიტეტ/],
      ['sports-underdog', /sports|team|coach|championship|underdog|competition|სპორტ|გუნდ|მწვრთნელ|ჩემპიონატ|შეჯიბრ/],
      ['music-fame', /music|singer|band|concert|fame|musician|მუსიკ|მომღერ|სიმღერ|კონცერტ|გიტარ/],
      ['medical-hospital', /doctor|hospital|patient|surgery|disease|medical|ექიმ|საავადმყოფ|პაციენტ|ოპერაცი|დაავად/],
    ];

    return new Set(concepts.filter(([, pattern]) => pattern.test(value)).map(([concept]) => concept));
  }

  private scenarioConceptBridges(queryConcepts: Set<string>, plotConcepts: Set<string>): number {
    const bridges: string[][] = [
      ['animal-chef', 'living-toys', 'ocean-fish', 'racing-cars', 'royal-animal-kingdom', 'ogre-fairytale', 'inside-mind-emotions', 'afterlife-family', 'dragon-viking', 'flying-house-adventure'],
      ['supernatural-hunters', 'detective-murder', 'revenge-betrayal', 'spy-mission'],
      ['future-robot', 'simulation-reality', 'alien-child-friendship', 'post-apocalypse'],
      ['wizard-school', 'ring-quest', 'dragon-viking', 'ogre-fairytale'],
      ['lost-child-parent', 'ocean-fish', 'alien-child-friendship', 'home-alone-burglars'],
    ];

    const bridgeHits = [...queryConcepts].filter((queryConcept) =>
      bridges.some((bridge) => bridge.includes(queryConcept) && bridge.some((concept) => plotConcepts.has(concept))),
    ).length;
    return queryConcepts.size ? bridgeHits / queryConcepts.size : 0;
  }

  private chunkWindowScenarioSimilarity(queryTokens: string[], plotTokens: string[]): number {
    const meaningful = queryTokens
      .filter((token) => token.length >= 4 && !this.isGenericScenarioTerm(token))
      .slice(0, 36);

    if (meaningful.length < 2 || !plotTokens.length) {
      return 0;
    }

    const chunks: string[][] = [];
    for (let size = 3; size <= 5; size += 1) {
      for (let index = 0; index <= meaningful.length - size; index += Math.max(1, size - 2)) {
        chunks.push(meaningful.slice(index, index + size));
      }
    }

    if (!chunks.length) {
      chunks.push(meaningful);
    }

    const windowSize = 70;
    const step = 22;
    const chunkScores = chunks.slice(0, 24).map((chunk) => {
      let best = 0;
      for (let start = 0; start < plotTokens.length; start += step) {
        const window = new Set(plotTokens.slice(start, start + windowSize));
        const hits = chunk.filter((token) => this.tokenAppears(token, window)).length;
        const localScore = hits / chunk.length;
        best = Math.max(best, localScore);
        if (start + windowSize >= plotTokens.length) {
          break;
        }
      }
      return best;
    });

    const strongChunks = chunkScores.filter((score) => score >= 0.67).length;
    const average = chunkScores.reduce((sum, score) => sum + score, 0) / chunkScores.length;
    const strongRatio = strongChunks / chunkScores.length;
    return Math.min(1, average * 0.52 + strongRatio * 0.48);
  }

  private narrativeTriadSimilarity(queryTokens: string[], plotTokens: string[]): number {
    const meaningful = [...new Set(queryTokens.filter((token) => token.length >= 4 && !this.isGenericScenarioTerm(token)))];
    if (meaningful.length < 3 || !plotTokens.length) {
      return 0;
    }

    const actorTokens = meaningful.filter((token) => this.isActorToken(token));
    const actionTokens = meaningful.filter((token) => this.isActionToken(token));
    const objectTokens = meaningful.filter((token) => !actorTokens.includes(token) && !actionTokens.includes(token));

    if ((!actorTokens.length && !objectTokens.length) || !actionTokens.length) {
      return 0;
    }

    const actorSet = new Set(actorTokens.length ? actorTokens : objectTokens.slice(0, 4));
    const actionSet = new Set(actionTokens);
    const objectSet = new Set(objectTokens.length ? objectTokens : meaningful.filter((token) => !actionSet.has(token)).slice(0, 6));
    const windowSize = 95;
    const step = 24;
    let best = 0;

    for (let start = 0; start < plotTokens.length; start += step) {
      const window = new Set(plotTokens.slice(start, start + windowSize));
      const actorHit = [...actorSet].some((token) => this.tokenAppears(token, window));
      const actionHit = [...actionSet].some((token) => this.tokenAppears(token, window));
      const objectHit = [...objectSet].some((token) => this.tokenAppears(token, window));
      const actorCoverage = [...actorSet].filter((token) => this.tokenAppears(token, window)).length / Math.max(1, actorSet.size);
      const actionCoverage = [...actionSet].filter((token) => this.tokenAppears(token, window)).length / Math.max(1, actionSet.size);
      const objectCoverage = [...objectSet].filter((token) => this.tokenAppears(token, window)).length / Math.max(1, objectSet.size);
      const triadBonus = actorHit && actionHit && objectHit ? 0.28 : actionHit && (actorHit || objectHit) ? 0.14 : 0;
      best = Math.max(best, actorCoverage * 0.25 + actionCoverage * 0.35 + objectCoverage * 0.25 + triadBonus);

      if (start + windowSize >= plotTokens.length) {
        break;
      }
    }

    return Math.min(1, best);
  }

  private isActorToken(token: string): boolean {
    return /brother|sister|sibling|family|father|mother|parent|child|friend|student|detective|police|killer|criminal|chef|cook|animal|creature|rat|mouse|fish|car|lion|king|princess|ogre|wizard|dragon|viking|robot|ai|alien|hero|pirate|doctor|patient|soldier|spy|agent|vampire|werewolf|ghost|demon|monster|ძმა|და|ოჯახ|მამ|დედ|ბავშვ|შვილ|მეგობ|მოსწავლ|დეტექტივ|პოლიცი|მკვლელ|მზარეულ|ცხოველ|ვირთხ|თაგვ|თევზ|მანქან|ლომ|მეფ|პრინცეს|ჯადოქ|დრაკონ|რობოტ|უცხოპლანეტ|გმირ|მეკობრ|ექიმ|ჯარისკაც|აგენტ|ვამპირ|მოჩვენ|დემონ/.test(token);
  }

  private isActionToken(token: string): boolean {
    return /hunt|search|seek|find|escape|surviv|fight|kill|murder|investigat|save|rescue|love|travel|repeat|reliv|steal|rob|kidnap|revenge|betray|swap|lose|remember|forget|crash|attack|follow|chase|hide|discover|solve|ნადირ|ძებნ|პოვ|გაქც|გადარჩ|ბრძოლ|მკვლელ|გამოძი|გადარჩენ|სიყვარულ|მოგზაურ|განმეორ|იპარ|გატაც|შურისძი|ღალატ|გაცვლ|დაკარგ|იხსენ|ავიწყ|ჩამოვარდ|თავდასხ|მისდევ|მალავ|აღმოაჩენ|ამოხსნ/.test(token);
  }

  private proximitySimilarity(actionTokens: string[], objectTokens: string[], plotTokens: string[]): number {
    if (!actionTokens.length || !objectTokens.length || !plotTokens.length) {
      return 0;
    }

    const actionIndexes = this.tokenIndexes(actionTokens, plotTokens);
    const objectIndexes = this.tokenIndexes(objectTokens, plotTokens);
    if (!actionIndexes.length || !objectIndexes.length) {
      return 0;
    }

    let closePairs = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    actionIndexes.forEach((actionIndex) => {
      objectIndexes.forEach((objectIndex) => {
        const distance = Math.abs(actionIndex - objectIndex);
        bestDistance = Math.min(bestDistance, distance);
        if (distance <= 10) {
          closePairs += 1;
        }
      });
    });

    const pairRatio = Math.min(1, closePairs / Math.max(actionTokens.length, objectTokens.length, 1));
    const distanceRatio = Number.isFinite(bestDistance) ? Math.max(0, 1 - bestDistance / 24) : 0;
    return Math.max(pairRatio, distanceRatio);
  }

  private tokenIndexes(needles: string[], haystack: string[]): number[] {
    const indexes: number[] = [];
    haystack.forEach((token, index) => {
      if (needles.some((needle) => token === needle || (needle.length >= 5 && (token.startsWith(needle) || needle.startsWith(token))))) {
        indexes.push(index);
      }
    });
    return indexes;
  }

  private distinctiveCoverage(queryTokens: string[], plotTokens: Set<string>): number {
    const generic = new Set([
      'movie',
      'film',
      'series',
      'show',
      'story',
      'person',
      'people',
      'man',
      'woman',
      'life',
      'world',
      'new',
      'young',
      'old',
      'კაცი',
      'ქალი',
      'ადამიან',
      'ცხოვრებ',
      'სამყარ',
      'ახალ',
    ]);
    const distinctive = [...new Set(queryTokens)].filter((token) => token.length >= 5 && !generic.has(token));
    if (!distinctive.length) {
      return 0;
    }
    return distinctive.filter((token) => this.tokenAppears(token, plotTokens)).length / distinctive.length;
  }

  private nameMatchScore(profile: TextProfile, plotText: string): { percent: number; score: number } {
    const normalizedPlot = plotText.toLowerCase();
    const original = profile.original.trim();
    const candidates = [
      original,
      ...profile.terms,
      ...this.ngrams(profile.terms.map((term) => term.toLowerCase()), 2),
      ...this.ngrams(profile.terms.map((term) => term.toLowerCase()), 3),
    ]
      .map((value) => value.toLowerCase().trim())
      .filter((value) => value.length >= 4);

    const unique = [...new Set(candidates)];
    const exact = unique.filter((candidate) => normalizedPlot.includes(candidate));
    if (exact.length) {
      const hasLongPhrase = exact.some((candidate) => candidate.includes(' ') || candidate.length >= 8);
      return { percent: hasLongPhrase ? 96 : 82, score: hasLongPhrase ? 1800 : 950 };
    }

    const plotTokens = new Set(this.scenarioTokens(normalizedPlot));
    const queryTokens = this.scenarioTokens(original);
    if (!queryTokens.length) {
      return { percent: 0, score: 0 };
    }

    const matches = queryTokens.filter((token) => this.tokenAppears(token, plotTokens));
    const ratio = matches.length / queryTokens.length;
    if (queryTokens.length <= 4 && ratio >= 0.75) {
      return { percent: Math.round(ratio * 80), score: ratio * 700 };
    }

    return { percent: 0, score: 0 };
  }

  private scenarioTokens(text: string): string[] {
    const stopwords = new Set([
      'the',
      'and',
      'for',
      'with',
      'that',
      'this',
      'from',
      'into',
      'about',
      'after',
      'before',
      'they',
      'their',
      'them',
      'his',
      'her',
      'him',
      'she',
      'who',
      'what',
      'when',
      'where',
      'while',
      'movie',
      'film',
      'series',
      'show',
      'story',
      'კაცი',
      'ქალი',
      'ადამიანი',
      'არის',
      'იყო',
      'და',
      'ან',
      'რომ',
      'როცა',
      'სადაც',
      'ერთ',
      'ერთი',
      'უნდა',
      'ხდება',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .split(/\s+/)
      .map((token) => this.stemScenarioToken(token.trim()))
      .filter((token) => token.length > 2 && !stopwords.has(token));
  }

  private stemScenarioToken(token: string): string {
    if (/^[a-z0-9-]+$/i.test(token)) {
      return this.canonicalScenarioToken(token
        .replace(/(ing|edly|edly|ed|es|s)$/i, '')
        .replace(/(tion|ions)$/i, 't')
        .replace(/(ers|er)$/i, ''));
    }

    return token
      .replace(/(ები|ებმა|ებს|ის|ში|ზე|თან|დან|ით|ად|მა|ს)$/u, '')
      .replace(/(დება|ებს|ობს|ოდა|ავს)$/u, '');
  }

  private canonicalScenarioToken(token: string): string {
    const aliases = new Map<string, string>([
      ['kid', 'child'], ['kids', 'child'], ['children', 'child'], ['boy', 'child'], ['girl', 'child'], ['son', 'child'], ['daughter', 'child'],
      ['dad', 'father'], ['daddy', 'father'], ['mom', 'mother'], ['mum', 'mother'], ['parent', 'family'], ['parents', 'family'],
      ['sibling', 'brother'], ['siblings', 'brother'], ['vehicle', 'car'], ['automobile', 'car'], ['driver', 'car'],
      ['jail', 'prison'], ['cell', 'prison'], ['cop', 'police'], ['officer', 'police'], ['detectiv', 'detective'],
      ['investigat', 'investigation'], ['murderer', 'killer'], ['criminal', 'crime'], ['spirit', 'ghost'], ['spirits', 'ghost'],
      ['haunt', 'ghost'], ['creatur', 'creature'], ['monster', 'creature'], ['beast', 'creature'], ['extraterrestrial', 'alien'],
      ['spacecraft', 'ship'], ['spaceship', 'ship'], ['boat', 'ship'], ['vessel', 'ship'], ['wizard', 'magic'], ['witch', 'magic'],
      ['spell', 'magic'], ['sorcerer', 'magic'], ['curse', 'magic'], ['robot', 'ai'], ['android', 'ai'], ['computer', 'technology'],
      ['virtual', 'simulation'], ['dreams', 'dream'], ['nightmares', 'nightmare'], ['restaurant', 'kitchen'], ['chef', 'cook'],
      ['cooking', 'cook'], ['food', 'cook'], ['meal', 'cook'], ['ocean', 'sea'], ['underwater', 'sea'], ['reef', 'sea'],
      ['wealthy', 'rich'], ['wealth', 'rich'], ['villain', 'enemy'], ['superhero', 'hero'], ['race', 'competition'],
      ['racing', 'competition'], ['contest', 'competition'], ['tournament', 'competition'], ['dead', 'death'], ['afterlife', 'death'],
      ['ancestor', 'family'], ['ancestors', 'family'],
    ]);
    return aliases.get(token) ?? token;
  }

  private ngrams(tokens: string[], size: number): string[] {
    if (tokens.length < size) {
      return [];
    }

    const result: string[] = [];
    for (let index = 0; index <= tokens.length - size; index += 1) {
      result.push(tokens.slice(index, index + size).join(' '));
    }
    return result;
  }

  private tokenAppears(token: string, plotTokens: Set<string>): boolean {
    if (plotTokens.has(token)) {
      return true;
    }
    if (token.length < 5) {
      return false;
    }

    for (const plotToken of plotTokens) {
      if (plotToken.length < 5) {
        continue;
      }
      if (plotToken.startsWith(token) || token.startsWith(plotToken)) {
        return true;
      }
      const distance = this.levenshteinDistance(token, plotToken);
      const maxLength = Math.max(token.length, plotToken.length);
      if (distance <= (token.length > 8 ? 2 : 1) || (maxLength >= 8 && 1 - distance / maxLength >= 0.78)) {
        return true;
      }
    }
    return false;
  }

  private levenshteinDistance(a: string, b: string): number {
    if (Math.abs(a.length - b.length) > 2) {
      return 3;
    }

    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      let lastDiagonal = previous[0];
      previous[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const oldDiagonal = previous[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, lastDiagonal + cost);
        lastDiagonal = oldDiagonal;
      }
    }
    return previous[b.length];
  }

  private hasSupernaturalIntent(terms: string[]): boolean {
    const set = new Set(terms);
    return (
      set.has('supernatural') ||
      (['brother', 'brothers', 'siblings'].some((term) => set.has(term)) &&
        ['hunt', 'hunter', 'hunters'].some((term) => set.has(term)) &&
        ['ghost', 'ghosts', 'spirit', 'spirits', 'demon', 'demons', 'paranormal'].some((term) => set.has(term)))
    );
  }

  private hasTimeLoopIntent(terms: string[], normalized: string): boolean {
    const set = new Set(terms);
    return (
      ['time loop', 'repeating day', 'same day', 'reliving the same day', 'stuck in time', 'deja vu', 'again and again'].some((term) => set.has(term)) ||
      /time loop|repeating day|same day|reliving the same day|stuck in time|deja vu|again and again|ერთიდაიგივე|ერთი და იგივე|იგივე დღეს|იმავე დღეს|ერთ დღეს|ბევრჯერ|განმეორ|მეორდება|დროის მარყუჟ|დროის ციკლ|ისევ და ისევ/.test(normalized)
    );
  }

  private emptyResult(): PagedMediaResult {
    return { page: 1, totalPages: 1, totalResults: 0, results: [] };
  }
}
