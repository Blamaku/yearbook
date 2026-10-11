// =====================================================
//  GLUK YEARBOOK 2026 — THINK IT'S EASY? (challenge.html)
//
//  "Think nursing is easy? Answer 10 questions every nurse should know." One quiz per profession that
//  GLUK trains for; each round draws 10 of its questions at random, and every answer explains itself.
//  Signed in with a yearbook profile, your own course's quiz comes first. Best scores stay on this
//  device (localStorage gluk-chal-<key>); a score can be shared as a challenge (challenge.html?p=<key>).
//
//  The questions are basic, well-established facts (textbook values, Kenyan regulators, landmark
//  theorists). They are for fun and learning, not professional advice. To change a question, edit QUIZZES.
// =====================================================
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = s => window.escHtml(s);
  const ROUND = 10;

  // q: the question; a: the right answer; w: three wrong answers; why: one line on the answer
  const QUIZZES = [
    { key: 'clinician', emoji: '🩺', who: 'a clinician', title: 'Think being a clinician is easy?', match: /clinical medicine|medical education|surgery/i, qs: [
      { q: 'What is a normal resting heart rate for an adult?', a: '60–100 beats a minute', w: ['30–50 beats a minute', '110–150 beats a minute', '160–200 beats a minute'], why: 'Below 60 is bradycardia, above 100 tachycardia.' },
      { q: 'What is a normal adult breathing rate at rest?', a: '12–20 breaths a minute', w: ['4–8 breaths a minute', '25–35 breaths a minute', '40–60 breaths a minute'], why: 'A fast breathing rate is one of the earliest signs that a patient is getting worse.' },
      { q: 'What is normal body temperature, roughly?', a: '37 °C', w: ['35 °C', '38.5 °C', '40 °C'], why: 'About 36.5–37.5 °C. 38 °C and above is a fever.' },
      { q: 'Which organ makes insulin?', a: 'The pancreas', w: ['The liver', 'The kidneys', 'The spleen'], why: 'The beta cells of the pancreas make insulin.' },
      { q: 'How is malaria spread?', a: 'By the bite of a female Anopheles mosquito', w: ['By the bite of an Aedes mosquito', 'By drinking dirty water', 'By the bite of a tsetse fly'], why: 'Aedes spreads dengue; tsetse flies spread sleeping sickness.' },
      { q: 'What is the largest organ of the human body?', a: 'The skin', w: ['The liver', 'The brain', 'The lungs'], why: 'The skin covers about 2 square metres in an adult.' },
      { q: 'How many bones does an adult human skeleton have?', a: '206', w: ['186', '226', '300'], why: 'A newborn has around 300; many fuse as the child grows.' },
      { q: 'Which blood group can give red cells to almost anyone?', a: 'O negative', w: ['AB positive', 'A positive', 'B negative'], why: 'O negative is the universal red cell donor; AB positive is the universal recipient.' },
      { q: 'Which body registers and licenses clinical officers in Kenya?', a: 'The Clinical Officers Council', w: ['The Nursing Council of Kenya', 'The Pharmacy and Poisons Board', 'The Kenya Medical Supplies Authority'], why: 'Under the Clinical Officers (Training, Registration and Licensing) Act, 2017.' },
      { q: 'Lack of which vitamin causes scurvy?', a: 'Vitamin C', w: ['Vitamin A', 'Vitamin D', 'Vitamin K'], why: 'Scurvy brings bleeding gums and slow-healing wounds.' },
      { q: 'What is the main job of red blood cells?', a: 'Carrying oxygen', w: ['Fighting infection', 'Clotting blood', 'Making antibodies'], why: 'Their haemoglobin carries oxygen from the lungs to the body.' },
      { q: 'Where is the femur?', a: 'In the thigh', w: ['In the arm', 'In the chest', 'In the skull'], why: 'It is the longest and strongest bone in the body.' },
      { q: 'Which vaccine does a baby in Kenya get at birth?', a: 'BCG', w: ['Measles', 'Yellow fever', 'HPV'], why: 'BCG protects against severe forms of tuberculosis.' },
      { q: 'Roughly what is a normal fasting blood sugar?', a: '4–6 mmol/L', w: ['1–2 mmol/L', '10–15 mmol/L', '20–25 mmol/L'], why: 'Fasting values of 7 mmol/L and above suggest diabetes.' },
      { q: 'What does a normal adult blood pressure look like?', a: 'About 120/80 mmHg', w: ['About 160/100 mmHg', 'About 60/30 mmHg', 'About 200/120 mmHg'], why: '140/90 mmHg and above, on repeated readings, is high blood pressure.' },
    ] },
    { key: 'nurse', emoji: '💉', who: 'a nurse', title: 'Think nursing is easy?', match: /nursing|midwif/i, qs: [
      { q: 'Which body registers nurses and midwives in Kenya?', a: 'The Nursing Council of Kenya', w: ['The Clinical Officers Council', 'The Kenya Medical Practitioners and Dentists Council', 'The Teachers Service Commission'], why: 'Every practising nurse needs a current NCK licence.' },
      { q: 'Who is known as the founder of modern nursing?', a: 'Florence Nightingale', w: ['Mary Seacole', 'Clara Barton', 'Virginia Henderson'], why: 'She set up nursing as a trained profession in the 1850s and 1860s.' },
      { q: 'When is International Nurses Day?', a: '12 May', w: ['7 April', '1 December', '5 October'], why: '12 May is Florence Nightingale’s birthday.' },
      { q: 'Which of these is NOT one of the "rights" of giving medicine?', a: 'The right price', w: ['The right patient', 'The right dose', 'The right route'], why: 'Right patient, drug, dose, route and time.' },
      { q: 'How long should washing hands with soap and water take?', a: '40–60 seconds', w: ['5 seconds', '10 seconds', '5 minutes'], why: 'The WHO’s time for a full handwash; an alcohol rub takes 20–30 seconds.' },
      { q: 'What mainly prevents pressure sores in a bedridden patient?', a: 'Turning them regularly', w: ['Giving more fluids only', 'Keeping the room cold', 'Raising the legs all day'], why: 'Commonly every 2 hours, with clean dry skin and good nutrition.' },
      { q: 'A patient’s temperature is 39 °C. What is this?', a: 'Pyrexia (a fever)', w: ['Hypothermia', 'Normal', 'Shock'], why: '38 °C and above is a fever.' },
      { q: 'What is a normal oxygen saturation (SpO₂) in a healthy adult?', a: '95–100%', w: ['70–80%', '50–60%', '85–88%'], why: 'Below about 92% usually needs attention.' },
      { q: 'Where should a used needle go?', a: 'Straight into a sharps container', w: ['Recapped and put in a pocket', 'Into the general waste bin', 'Into the patient’s bedside drawer'], why: 'Never recap: needle-stick injuries spread HIV and hepatitis.' },
      { q: 'What is the highest score on the Glasgow Coma Scale?', a: '15', w: ['10', '20', '100'], why: 'It runs from 3 (deep coma) to 15 (fully awake).' },
      { q: 'How do you best position a patient who is short of breath?', a: 'Sitting up (Fowler’s position)', w: ['Flat on their back', 'Head lower than the feet', 'Flat on their stomach'], why: 'Sitting up lets the lungs expand more easily.' },
      { q: 'When is a newborn’s Apgar score taken?', a: 'At 1 and 5 minutes after birth', w: ['At 1 hour and 1 day', 'Only on discharge', 'Before birth'], why: 'It checks colour, heart rate, reflexes, muscle tone and breathing.' },
      { q: 'What is oral rehydration solution (ORS) mainly for?', a: 'Dehydration from diarrhoea', w: ['High blood pressure', 'Malaria', 'Allergies'], why: 'For children, it is given together with zinc.' },
      { q: 'Which is a common site for an adult intramuscular injection?', a: 'The deltoid (upper arm)', w: ['The fingertip', 'Under the tongue', 'The eyelid'], why: 'The deltoid and ventrogluteal sites are common for adults.' },
      { q: 'What is a normal adult pulse at rest?', a: '60–100 beats a minute', w: ['20–40 beats a minute', '120–160 beats a minute', '180–220 beats a minute'], why: 'Count it for a full minute if it is irregular.' },
    ] },
    { key: 'teacher', emoji: '📚', who: 'a teacher', title: 'Think teaching is easy?', match: /education/i, qs: [
      { q: 'Which body registers and employs teachers in Kenya?', a: 'The Teachers Service Commission (TSC)', w: ['KNEC', 'KICD', 'The Ministry of Health'], why: 'A teacher needs a TSC number to teach in a public school.' },
      { q: 'Which body runs Kenya’s national examinations?', a: 'KNEC', w: ['TSC', 'KICD', 'KEMSA'], why: 'The Kenya National Examinations Council.' },
      { q: 'Which body develops Kenya’s school curriculum?', a: 'KICD', w: ['KNEC', 'TSC', 'CUE'], why: 'The Kenya Institute of Curriculum Development.' },
      { q: 'What replaced 8-4-4 in Kenya, starting in 2017?', a: 'The Competency-Based Curriculum (CBC)', w: ['The 7-4-2-3 system', 'The 6-3-3-4 system', 'The IB curriculum'], why: 'It focuses on what learners can do, not only what they know.' },
      { q: 'What is the structure of Kenya’s new education system?', a: '2-6-3-3-3', w: ['8-4-4', '7-4-2-3', '6-3-3-4'], why: 'Pre-primary, primary, junior school, senior school, university.' },
      { q: 'Which grades make up junior school under CBC?', a: 'Grades 7 to 9', w: ['Grades 1 to 3', 'Grades 4 to 6', 'Grades 10 to 12'], why: 'Senior school then covers Grades 10 to 12.' },
      { q: 'In the revised Bloom’s taxonomy, which is the highest level?', a: 'Create', w: ['Remember', 'Understand', 'Apply'], why: 'Remember, understand, apply, analyse, evaluate, create.' },
      { q: 'What is formative assessment?', a: 'Checking learning during teaching, to guide the next steps', w: ['A final exam at the end of the year', 'Ranking learners against each other', 'Testing only spelling'], why: 'Summative assessment is the one that comes at the end.' },
      { q: 'Who came up with the "zone of proximal development"?', a: 'Lev Vygotsky', w: ['Jean Piaget', 'B. F. Skinner', 'Howard Gardner'], why: 'What a learner can do with help, but not yet alone.' },
      { q: 'Who proposed the theory of multiple intelligences?', a: 'Howard Gardner', w: ['Lev Vygotsky', 'John Dewey', 'Benjamin Bloom'], why: 'Musical, logical, linguistic, interpersonal and more.' },
      { q: 'What is Jean Piaget best known for?', a: 'The stages of cognitive development', w: ['The hierarchy of needs', 'Classical conditioning', 'The four Ps of marketing'], why: 'Sensorimotor, pre-operational, concrete operational and formal operational.' },
      { q: 'When is World Teachers’ Day?', a: '5 October', w: ['12 May', '1 May', '10 December'], why: 'UNESCO marks it every year.' },
      { q: 'What does inclusive education mean?', a: 'All learners, including those with special needs, learn together', w: ['Only the top learners join a class', 'Learners with disabilities are always taught separately', 'Boys and girls learn in different schools'], why: 'It adapts teaching to fit each learner.' },
      { q: 'Which document plans a whole term’s lessons?', a: 'The scheme of work', w: ['The register', 'The report card', 'The timetable only'], why: 'Lesson plans then break it down lesson by lesson.' },
      { q: 'Good lesson objectives use verbs that are…', a: 'Observable and measurable, like "list" or "solve"', w: ['Vague, like "know" or "appreciate"', 'Always in the past tense', 'As long as possible'], why: 'You can only assess what you can see learners do.' },
    ] },
    { key: 'publichealth', emoji: '🌍', who: 'a public health officer', title: 'Think public health is easy?', match: /public health|community health|nutrition|health service/i, qs: [
      { q: 'How does the WHO define health?', a: 'Complete physical, mental and social well-being, not merely the absence of disease', w: ['Not being in hospital', 'Having no infections', 'Being able to work'], why: 'From the WHO constitution of 1948.' },
      { q: 'How does cholera mainly spread?', a: 'Through contaminated water and food', w: ['Through mosquito bites', 'Through shaking hands only', 'Through the air over long distances'], why: 'Safe water, sanitation and hygiene stop outbreaks.' },
      { q: 'What does epidemiology study?', a: 'How diseases are spread across populations, and why', w: ['Only the skin', 'How drugs are made', 'The history of hospitals'], why: 'Who gets sick, where, when and why.' },
      { q: 'What is herd immunity?', a: 'Protection that comes when enough of a community is immune', w: ['Immunity animals give to people', 'A vaccine for cattle', 'Immunity you are born with'], why: 'It protects people who cannot be vaccinated, such as newborns.' },
      { q: 'For how long are babies best breastfed exclusively?', a: 'The first 6 months', w: ['The first 2 weeks', 'The first 2 months', 'The first 2 years'], why: 'Then breastfeeding continues alongside other foods to 2 years and beyond.' },
      { q: 'Which disease has been wiped out worldwide by vaccination?', a: 'Smallpox', w: ['Malaria', 'Tuberculosis', 'Measles'], why: 'The WHO declared it eradicated in 1980.' },
      { q: 'What is given with ORS to a child with diarrhoea?', a: 'Zinc', w: ['Antibiotics every time', 'Iron', 'Nothing else, ever'], why: 'Zinc for 10–14 days shortens the illness.' },
      { q: 'Which of these is primary prevention?', a: 'Vaccinating children', w: ['Screening for cancer', 'Physiotherapy after a stroke', 'Treating an infection'], why: 'Primary prevention stops a disease before it starts.' },
      { q: 'What does "incidence" mean?', a: 'The number of new cases in a given time', w: ['All the cases at one moment', 'The number of deaths', 'How serious a disease is'], why: 'Prevalence counts all the cases, old and new.' },
      { q: 'What are Kenya’s community health workers now called?', a: 'Community Health Promoters', w: ['Clinical Officers', 'Public Health Inspectors', 'Village Elders'], why: 'The Primary Health Care Act, 2023 renamed the community health volunteers.' },
      { q: 'What is a pandemic?', a: 'An epidemic that spreads across countries or continents', w: ['A disease in one village', 'A disease only animals get', 'A common cold'], why: 'COVID-19 was declared a pandemic in March 2020.' },
      { q: 'What causes tuberculosis?', a: 'A bacterium', w: ['A virus', 'A fungus', 'A worm'], why: 'Mycobacterium tuberculosis, spread through the air by coughing.' },
      { q: 'Which mosquito spreads dengue fever?', a: 'Aedes', w: ['Anopheles', 'Culex only', 'None: it is waterborne'], why: 'Aedes bites mostly by day.' },
      { q: 'How is body mass index (BMI) worked out?', a: 'Weight in kg divided by height in metres, squared', w: ['Height divided by weight', 'Weight times age', 'Waist divided by hips'], why: 'For adults, 18.5–24.9 is a healthy range.' },
      { q: 'When is World Health Day?', a: '7 April', w: ['12 May', '1 December', '10 October'], why: 'It marks the founding of the WHO in 1948.' },
    ] },
    { key: 'counsellor', emoji: '🧠', who: 'a counsellor', title: 'Think counselling is easy?', match: /counsel|psycholog/i, qs: [
      { q: 'Who is known as the father of psychoanalysis?', a: 'Sigmund Freud', w: ['Carl Rogers', 'B. F. Skinner', 'Abraham Maslow'], why: 'He developed talk therapy in the late 1800s.' },
      { q: 'What is at the bottom of Maslow’s hierarchy of needs?', a: 'Physiological needs: food, water, sleep', w: ['Self-actualisation', 'Esteem', 'Belonging'], why: 'Basic needs come first, then safety, belonging, esteem and self-actualisation.' },
      { q: 'Who developed person-centred therapy?', a: 'Carl Rogers', w: ['Sigmund Freud', 'Ivan Pavlov', 'Aaron Beck'], why: 'It trusts the client to find their own way forward.' },
      { q: 'Which of these is NOT one of Rogers’ core conditions?', a: 'Giving advice', w: ['Empathy', 'Unconditional positive regard', 'Congruence (genuineness)'], why: 'The core conditions describe the counsellor’s attitude, not advice-giving.' },
      { q: 'When may a counsellor break confidentiality?', a: 'When there is a serious risk of harm to the client or others', w: ['When a friend asks', 'When the client is late', 'Never, whatever happens'], why: 'Limits to confidentiality are explained at the start.' },
      { q: 'Cognitive behavioural therapy (CBT) links which three things?', a: 'Thoughts, feelings and behaviour', w: ['Diet, sleep and money', 'Past lives, dreams and luck', 'Family, school and church'], why: 'Change one, and the others change too.' },
      { q: 'Which of these is part of active listening?', a: 'Paraphrasing what the client said', w: ['Checking your phone', 'Finishing their sentences', 'Changing the subject'], why: 'It shows you have understood, and lets them correct you.' },
      { q: 'What is Erik Erikson known for?', a: 'The stages of psychosocial development', w: ['Classical conditioning', 'The intelligence test', 'The five stages of grief'], why: 'Eight stages, from trust versus mistrust to integrity versus despair.' },
      { q: 'Who discovered classical conditioning?', a: 'Ivan Pavlov', w: ['B. F. Skinner', 'Carl Jung', 'Albert Bandura'], why: 'His dogs drooled at the sound that came before their food.' },
      { q: 'Who is linked with operant conditioning?', a: 'B. F. Skinner', w: ['Ivan Pavlov', 'Sigmund Freud', 'Jean Piaget'], why: 'Behaviour that is rewarded is repeated.' },
      { q: 'Who described the five stages of grief?', a: 'Elisabeth Kübler-Ross', w: ['Melanie Klein', 'Anna Freud', 'Karen Horney'], why: 'Denial, anger, bargaining, depression and acceptance.' },
      { q: 'What does empathy mean in counselling?', a: 'Understanding the client’s feelings from their point of view', w: ['Feeling sorry for the client', 'Agreeing with everything', 'Telling them what you would do'], why: 'Sympathy feels for someone; empathy feels with them.' },
      { q: 'When is World Mental Health Day?', a: '10 October', w: ['7 April', '1 December', '12 May'], why: 'A day to talk openly about mental health.' },
      { q: 'Who is known for social learning theory (learning by watching others)?', a: 'Albert Bandura', w: ['Ivan Pavlov', 'Carl Rogers', 'Erik Erikson'], why: 'His Bobo doll experiments showed children copying adults.' },
    ] },
    { key: 'business', emoji: '💼', who: 'an accountant or business manager', title: 'Think business and accounting are easy?', match: /commerce|business|accounting|finance|procurement|human resource/i, qs: [
      { q: 'What is the accounting equation?', a: 'Assets = Liabilities + Equity', w: ['Assets = Profit − Tax', 'Sales = Cost + Tax', 'Equity = Assets + Liabilities'], why: 'Every balance sheet balances on it.' },
      { q: 'Which body collects taxes in Kenya?', a: 'The Kenya Revenue Authority (KRA)', w: ['The Central Bank of Kenya', 'The Capital Markets Authority', 'KASNEB'], why: 'KRA runs the iTax system.' },
      { q: 'Which body examines CPA (K) students?', a: 'KASNEB', w: ['KRA', 'KNEC', 'CBK'], why: 'ICPAK then registers qualified accountants.' },
      { q: 'What is Kenya’s standard VAT rate?', a: '16%', w: ['5%', '10%', '30%'], why: 'Some goods are zero-rated or exempt.' },
      { q: 'Who sets the Central Bank Rate in Kenya?', a: 'The Central Bank of Kenya', w: ['The National Treasury alone', 'The commercial banks', 'The Nairobi Securities Exchange'], why: 'Its Monetary Policy Committee sets it.' },
      { q: 'In double-entry bookkeeping, every debit has…', a: 'A matching credit', w: ['A matching tax', 'Nothing else', 'A receipt only'], why: 'That is why the trial balance balances.' },
      { q: 'What does SWOT stand for?', a: 'Strengths, Weaknesses, Opportunities, Threats', w: ['Sales, Wages, Orders, Tax', 'Systems, Workers, Owners, Targets', 'Supply, Wealth, Output, Trade'], why: 'Strengths and weaknesses are inside; opportunities and threats are outside.' },
      { q: 'How is gross profit worked out?', a: 'Sales minus the cost of sales', w: ['Sales minus all expenses and tax', 'Assets minus liabilities', 'Sales plus expenses'], why: 'Net profit then takes off the running expenses too.' },
      { q: 'What is depreciation?', a: 'Spreading the cost of an asset over its useful life', w: ['A rise in an asset’s price', 'A kind of tax', 'Money paid to shareholders'], why: 'A vehicle bought for 5 years is charged a share each year.' },
      { q: 'When a product’s price goes up, its demand usually…', a: 'Falls', w: ['Rises', 'Stays exactly the same', 'Doubles'], why: 'The law of demand, all else being equal.' },
      { q: 'Which is NOT one of the four Ps of marketing?', a: 'Profit', w: ['Product', 'Price', 'Promotion'], why: 'Product, price, place and promotion.' },
      { q: 'What does liquidity mean?', a: 'How quickly assets can be turned into cash', w: ['How much water a firm uses', 'How big the profit is', 'How many staff a firm has'], why: 'Cash is the most liquid asset; land is one of the least.' },
      { q: 'When was M-Pesa launched in Kenya?', a: '2007', w: ['1997', '2012', '2017'], why: 'Safaricom launched it in March 2007.' },
      { q: 'Where are shares in listed Kenyan companies bought and sold?', a: 'The Nairobi Securities Exchange', w: ['The Kenya Revenue Authority', 'KASNEB', 'The Central Bank of Kenya'], why: 'The Capital Markets Authority regulates it.' },
    ] },
    { key: 'it', emoji: '💻', who: 'an IT professional', title: 'Think IT is easy?', match: /information technology|computer/i, qs: [
      { q: 'What does CPU stand for?', a: 'Central Processing Unit', w: ['Computer Power Unit', 'Central Program Utility', 'Core Processing Upload'], why: 'It carries out a program’s instructions.' },
      { q: 'How many bits are there in a byte?', a: '8', w: ['2', '4', '16'], why: 'A byte can hold 256 different values.' },
      { q: 'What is HTML used for?', a: 'Structuring web pages', w: ['Storing passwords', 'Running the CPU', 'Sending emails only'], why: 'CSS styles the page; JavaScript makes it interactive.' },
      { q: 'What is 5 written in binary?', a: '101', w: ['110', '111', '100'], why: '4 + 0 + 1 = 5.' },
      { q: 'Which of these is an operating system?', a: 'Linux', w: ['Python', 'Excel', 'Chrome'], why: 'Windows, macOS, Android and Linux are operating systems.' },
      { q: 'What does IP stand for in "IP address"?', a: 'Internet Protocol', w: ['Internal Program', 'Internet Provider', 'Input Port'], why: 'Every device on a network has one.' },
      { q: 'Which is the strongest password?', a: 'A long mix of words, numbers and symbols', w: ['Your name', '123456', 'Your date of birth'], why: 'Length matters most; never reuse passwords.' },
      { q: 'What is phishing?', a: 'Tricking people into giving away details through fake messages', w: ['A type of computer fan', 'Fixing a network cable', 'Backing up files'], why: 'Check the sender and the link before you click.' },
      { q: 'What happens to what is in RAM when the computer is switched off?', a: 'It is lost', w: ['It is saved forever', 'It moves to the cloud', 'It prints out'], why: 'RAM is working memory; storage keeps files.' },
      { q: 'What is SQL used for?', a: 'Working with data in databases', w: ['Drawing pictures', 'Writing music', 'Charging phones'], why: 'Structured Query Language.' },
      { q: 'What does the "S" in HTTPS mean?', a: 'Secure: the connection is encrypted', w: ['Speed', 'Server', 'Simple'], why: 'It keeps what you send hidden from others on the network.' },
      { q: 'Which Kenyan law protects people’s personal data?', a: 'The Data Protection Act, 2019', w: ['The Traffic Act', 'The Copyright Act only', 'The Employment Act'], why: 'It set up the Office of the Data Protection Commissioner.' },
      { q: 'What does "open source" mean?', a: 'Anyone can see and change the source code', w: ['The software is always free of bugs', 'The computer has no case', 'Only the government can use it'], why: 'Linux and Firefox are open source.' },
      { q: 'Which of these is a programming language?', a: 'Python', w: ['Wi-Fi', 'USB', 'PDF'], why: 'Python is popular for data, web and automation.' },
    ] },
  ];
  const byKey = Object.fromEntries(QUIZZES.map(z => [z.key, z]));

  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const bestOf = k => { try { return Number(localStorage.getItem('gluk-chal-' + k)) || 0; } catch (e) { return 0; } };
  const saveBest = (k, n) => { try { if (n > bestOf(k)) localStorage.setItem('gluk-chal-' + k, String(n)); } catch (e) {} };
  let mine = null, course = null, quiz = null, user = null, hasProfile = false;   // mine: the quiz shown first; course: the one from your profile

  /* ── The cards ──────────────────────────────────── */
  function paintCards() {
    const order = mine ? [mine, ...QUIZZES.filter(z => z !== mine)] : QUIZZES;
    $('chCards').innerHTML = order.map(z => {
      const b = bestOf(z.key);
      return `<button type="button" class="ch-card${z === mine ? ' mine' : ''}" data-play="${z.key}">
        <span class="ch-emoji" aria-hidden="true">${z.emoji}</span>
        <span class="ch-t"><b>${E(z.title)}</b><small>10 questions every ${E(z.who.replace(/^an? /, ''))} should know${z === course ? ' · your course' : ''}</small></span>
        <span class="ch-best">${b ? `${b}/${ROUND}` : 'Play ›'}</span></button>`;
    }).join('');
  }

  /* ── One round (a full-screen sheet the back button closes: #play-<key>) ── */
  function newRound(z) {
    return { z, i: 0, score: 0, answered: false,
      qs: shuffle(z.qs).slice(0, ROUND).map(q => { const opts = shuffle([q.a, ...q.w]); return { ...q, opts, right: opts.indexOf(q.a) }; }) };
  }
  function paintQ() {
    const q = quiz.qs[quiz.i];
    $('chTitle').textContent = quiz.z.title;
    $('chCount').textContent = `${quiz.i + 1} / ${quiz.qs.length}`;
    $('chScore').textContent = `${quiz.score} correct`;
    $('chBar').style.width = (quiz.i / quiz.qs.length * 100) + '%';
    $('chBody').classList.remove('done');
    $('chBody').innerHTML = `<p class="kq-ask" id="chAsk">${E(q.q)}</p>
      <div class="kq-opts">${q.opts.map((o, i) => `<button type="button" class="kq-opt" data-i="${i}">${E(o)}</button>`).join('')}</div>
      <p class="kq-feedback" id="chFb" aria-live="polite"></p>
      <button type="button" class="kq-next" id="chNext" hidden>${quiz.i + 1 < quiz.qs.length ? 'Next question ›' : 'See my score ›'}</button>`;
    quiz.answered = false;
  }
  function answer(i) {
    if (!quiz || quiz.answered) return;
    const q = quiz.qs[quiz.i], right = i === q.right;
    quiz.answered = true;
    if (right) quiz.score++;
    $('chBody').querySelectorAll('[data-i]').forEach(b => {
      const k = +b.dataset.i; b.disabled = true;
      b.classList.add(k === q.right ? 'right' : k === i ? 'wrong' : 'dim');
    });
    $('chBody').classList.add('done');
    $('chFb').className = 'kq-feedback ' + (right ? 'yes' : 'no');
    $('chFb').innerHTML = `${right ? '✅ Correct!' : `❌ It’s <b>${E(q.a)}</b>.`} ${E(q.why)}`;
    $('chScore').textContent = `${quiz.score} correct`;
    $('chNext').hidden = false; $('chNext').focus({ preventScroll: true });
  }
  function verdict(n, z) {
    if (n === ROUND) return `Perfect! You think like ${z.who}. 🏆`;
    if (n >= 8) return `Impressive. ${z.who[0].toUpperCase() + z.who.slice(1)} would be proud. 🎓`;
    if (n >= 5) return 'Not bad, but it’s not as easy as it looks, is it?';
    return `Still think it’s easy? Respect to every ${z.who.replace(/^an? /, '')}! 😅`;
  }
  function finish() {
    const z = quiz.z, n = quiz.score, was = bestOf(z.key);
    saveBest(z.key, n);
    $('chBar').style.width = '100%'; $('chCount').textContent = 'Done';
    const join = !user ? `<p class="ch-join">Are you a GLUK student? <button type="button" class="kq-link" data-act="join">Join the yearbook</button> and challenge your classmates.</p>`
      : !hasProfile ? `<p class="ch-join">Put yourself in the yearbook: <a class="kq-link" href="profiles.html?action=add">create your profile</a>.</p>` : '';
    $('chBody').classList.remove('done');
    $('chBody').innerHTML = `<div class="kq-end">
      <div class="kq-big">${n}<span>/${ROUND}</span></div>
      <p class="kq-msg">${E(verdict(n, z))}</p>
      <p class="kq-bestline">${n > was && was ? 'A new best score!' : `Your best: ${Math.max(n, was)}/${ROUND}`}</p>
      ${join}
      <button type="button" class="kq-next" data-act="share">Challenge a friend</button>
      <button type="button" class="kq-ghost" data-act="again">Play again (new questions)</button>
      <button type="button" class="kq-ghost" data-act="other">Try another profession</button>
      <p class="ch-note">For fun and learning: basic facts every ${E(z.who.replace(/^an? /, ''))} meets early on, not professional advice.</p></div>`;
    paintCards();
  }
  async function share() {
    const z = quiz ? quiz.z : mine || QUIZZES[0], n = quiz ? quiz.score : bestOf(z.key);
    const text = `I got ${n}/${ROUND} on "${z.title}" on the GLUK Yearbook. Think you can beat me?`;
    const url = `${location.origin}/challenge.html?p=${z.key}`;
    try {
      if (navigator.share) { await navigator.share({ title: z.title, text, url }); return; }
      window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url), '_blank', 'noopener');
    } catch (e) { /* closed the share sheet */ }
  }

  let openedHere = false;
  const go = hash => { openedHere = true; location.hash = hash; };
  function close() {
    if (openedHere) { openedHere = false; history.back(); return; }
    history.replaceState(null, '', location.pathname + location.search); route();
  }
  function route() {
    const m = /^#play-([a-z]+)$/.exec(location.hash), z = m && byKey[m[1]];
    $('chQuiz').hidden = !z;
    document.documentElement.style.overflow = z ? 'hidden' : '';
    if (z && (!quiz || quiz.z !== z)) { quiz = newRound(z); paintQ(); }
    if (!z) { quiz = null; openedHere = false; }
  }

  /* ── Wiring ────────────────────────────────────── */
  $('chCards').addEventListener('click', e => { const b = e.target.closest('[data-play]'); if (b) { quiz = null; go('play-' + b.dataset.play); } });
  $('chMine').addEventListener('click', () => { quiz = null; go('play-' + (mine || QUIZZES[0]).key); });
  $('chX').addEventListener('click', close);
  $('chBody').addEventListener('click', e => {
    const o = e.target.closest('[data-i]'); if (o) { answer(+o.dataset.i); return; }
    if (e.target.closest('#chNext')) { quiz.i++; if (quiz.i < quiz.qs.length) paintQ(); else finish(); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'share') share();
    else if (a.dataset.act === 'again') { quiz = newRound(quiz.z); paintQ(); }
    else if (a.dataset.act === 'other') { close(); setTimeout(() => $('chCards').scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); }
    else if (a.dataset.act === 'join') window.openAuthModal(null, 'signup');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('chQuiz').hidden) close(); });
  window.addEventListener('hashchange', route);

  // A shared link (challenge.html?p=nurse) opens on that quiz's card; your own course's quiz comes first
  function paintHero() {
    mine = course || byKey[new URLSearchParams(location.search).get('p')] || null;
    $('chMine').textContent = mine ? `▶ ${mine.title}` : '▶ Play a quiz';
    paintCards();
  }
  async function findMine(u) {
    user = u; hasProfile = false; course = null;
    if (u) {
      try {
        const { data } = await supabase.from('profiles_public').select('course,dept').eq('uid', u.uid).limit(1);
        const p = data && data[0];
        if (p) { hasProfile = true; course = QUIZZES.find(q => q.match.test(p.course || '')) || QUIZZES.find(q => q.match.test(p.dept || '')) || null; }
      } catch (e) { /* the cards still work */ }
    }
    paintHero();
  }
  paintHero(); route();
  auth.onAuthStateChanged(findMine);

  window.__chal = { QUIZZES, newRound };          // for the tests
})();
