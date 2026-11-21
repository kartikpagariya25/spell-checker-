/*
 * Frequent misspellings whose right answer is not what plain edit distance
 * would pick (a more common word is one edit away, or the fix needs two
 * edits). Every key must be a non-word; every value a correct spelling.
 */
(function (root) {
  'use strict';

  const COMMON_TYPOS = {
    alot: 'a lot', collegue: 'colleague', colleage: 'colleague', basicly: 'basically', tounge: 'tongue',
    wensday: 'Wednesday', wendsday: 'Wednesday', thrusday: 'Thursday', tuesady: 'Tuesday', saterday: 'Saturday',
    computr: 'computer', mispell: 'misspell', pleae: 'please', plese: 'please', emial: 'email',
    delte: 'delete', recieve: 'receive', recieved: 'received', reciept: 'receipt', beleive: 'believe',
    definately: 'definitely', definatly: 'definitely', seperate: 'separate',
    seperately: 'separately', occured: 'occurred', occurence: 'occurrence', occuring: 'occurring',
    untill: 'until', begining: 'beginning', calender: 'calendar', enviroment: 'environment',
    goverment: 'government', immediatly: 'immediately', independant: 'independent', knowlege: 'knowledge',
    neccessary: 'necessary', necesary: 'necessary', occassion: 'occasion', recomend: 'recommend',
    reccomend: 'recommend', refered: 'referred', relevent: 'relevant', succesful: 'successful',
    successfull: 'successful', sucess: 'success', tecnology: 'technology', truely: 'truly',
    writting: 'writing', acommodate: 'accommodate', accomodate: 'accommodate', adress: 'address',
    apparantly: 'apparently', assistent: 'assistant', buisness: 'business', bussiness: 'business',
    catagory: 'category', commited: 'committed', concious: 'conscious', diffrent: 'different',
    dissapear: 'disappear', dissapoint: 'disappoint', embarass: 'embarrass', exagerate: 'exaggerate',
    foriegn: 'foreign', gaurd: 'guard', harrass: 'harass', hieght: 'height', interupt: 'interrupt',
    lenght: 'length', libary: 'library', noticable: 'noticeable', peice: 'piece', posession: 'possession',
    priviledge: 'privilege', questionaire: 'questionnaire', rythm: 'rhythm', sieze: 'seize',
    speach: 'speech', strenght: 'strength', suprise: 'surprise', thourough: 'thorough', vaccum: 'vacuum',
    wether: 'whether', yeild: 'yield', thnaks: 'thanks', thanx: 'thanks', mesage: 'message',
    pasword: 'password', serach: 'search', finsih: 'finish', chnage: 'change', dwonload: 'download',
    wokring: 'working', importnat: 'important', probelm: 'problem', qusetion: 'question',
    anwser: 'answer', meetign: 'meeting', schedual: 'schedule', shedule: 'schedule', proffesional: 'professional',
    profesional: 'professional', experiance: 'experience', experence: 'experience', intresting: 'interesting',
    interseting: 'interesting', langauge: 'language', laguage: 'language', developement: 'development',
    managment: 'management', responsability: 'responsibility', pharmacey: 'pharmacy', tomorow: 'tomorrow',
    tommorrow: 'tomorrow', tommorow: 'tomorrow', yesturday: 'yesterday', excercise: 'exercise',
    existance: 'existence', fourty: 'forty', gratefull: 'grateful', greatful: 'grateful', happend: 'happened',
    inteligent: 'intelligent', milenium: 'millennium', neice: 'niece', persue: 'pursue',
    publically: 'publicly', realy: 'really', reallly: 'really', resturant: 'restaurant', sentance: 'sentence',
    sincerly: 'sincerely', tendancy: 'tendency', unfortunatly: 'unfortunately', unfortunatley: 'unfortunately',
    usally: 'usually', wich: 'which', whcih: 'which', abscence: 'absence',
    accross: 'across', agressive: 'aggressive', arguement: 'argument', basicaly: 'basically',
    comming: 'coming', completly: 'completely', copywrite: 'copyright', curiousity: 'curiosity',
    decison: 'decision', desparate: 'desperate', dilemna: 'dilemma', existant: 'existent',
    febuary: 'February', wendesday: 'Wednesday', goverment: 'government', hygeine: 'hygiene',
    ignorence: 'ignorance', jewelery: 'jewellery', liason: 'liaison', maintainance: 'maintenance',
    millenium: 'millennium', mischievious: 'mischievous', ocurred: 'occurred', paralell: 'parallel',
    paticular: 'particular', particulary: 'particularly', prefered: 'preferred', pronounciation: 'pronunciation',
    remeber: 'remember', rember: 'remember', secratary: 'secretary', tatoo: 'tattoo', tommorows: 'tomorrow\'s',
  };

  // Case-insensitive lookups are done on lowercase keys; weekday/month fixes
  // above are capitalised words, which is correct wherever they appear.
  const api = { COMMON_TYPOS };
  root.SpellFixCommonTypos = COMMON_TYPOS;
  if (typeof module !== 'undefined' && module.exports) module.exports = COMMON_TYPOS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
