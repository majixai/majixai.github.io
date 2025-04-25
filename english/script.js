const lessonTitle = document.getElementById('lesson-title');
const lessonContent = document.getElementById('lesson-content');
const progressBar = document.getElementById('progress-bar');
const instructions = document.querySelector('.instructions');

let timerInterval = null;
let timerDuration = 60000; // 60 seconds in milliseconds

// --- 30 Sample English Lesson Snippets ---
const lessons = [
    { title: "Idiom: 'Bite the bullet'", content: "Meaning: To face a difficult or unpleasant situation with courage and stoicism.<br>Example: <em>'I didn't want to work late, but I had to <strong>bite the bullet</strong> and finish the project.'</em>" },
    { title: "Common Mistake: 'Less' vs 'Fewer'", content: "Use <strong>fewer</strong> for countable items (things you can count, like apples, chairs).<br>Use <strong>less</strong> for uncountable items (like water, sugar, time).<br>Example: <em>'There are <strong>fewer</strong> cookies in the jar.'</em> vs <em>'I have <strong>less</strong> time today.'</em>" },
    { title: "Vocabulary: 'Ephemeral'", content: "Meaning: Lasting for a very short time; fleeting.<br>Example: <em>'The beauty of the cherry blossoms is <strong>ephemeral</strong>, lasting only a week or two.'</em>" },
    { title: "Pronunciation Tip: 'TH' sound", content: "Practice the 'th' sound (θ / ð). Place your tongue tip lightly between your teeth.<br>Voiceless (θ): <strong>th</strong>ink, <strong>th</strong>ree, ba<strong>th</strong>.<br>Voiced (ð): <strong>th</strong>is, <strong>th</strong>at, mo<strong>th</strong>er." },
    { title: "Phrasal Verb: 'Look up'", content: "Meaning 1: To search for information (e.g., in a dictionary or online). Example: <em>'I need to <strong>look up</strong> this word.'</em><br>Meaning 2: To improve. Example: <em>'Things are finally <strong>looking up</strong>!'</em>" },
    { title: "Grammar: Present Perfect", content: "Used for actions started in the past that continue to the present OR finished actions with a result in the present.<br>Form: <code>have/has + past participle</code><br>Example: <em>'I <strong>have lived</strong> here for five years.'</em> (still live here)<br>Example: <em>'She <strong>has finished</strong> her homework.'</em> (result: homework is done now)" },
    { title: "Vocabulary: 'Ubiquitous'", content: "Meaning: Present, appearing, or found everywhere.<br>Example: <em>'Smartphones have become <strong>ubiquitous</strong> in modern society.'</em>" },
    { title: "Idiom: 'Break a leg'", content: "Meaning: Good luck! (Often said to performers before they go on stage).<br>Example: <em>'<strong>Break a leg</strong> in your audition today!'</em>" },
    { title: "Common Mistake: 'Its' vs 'It's'", content: "<strong>It's</strong> is a contraction for 'it is' or 'it has'.<br><strong>Its</strong> is a possessive pronoun (shows ownership).<br>Example: <em>'<strong>It's</strong> raining outside.'</em> (It is raining)<br>Example: <em>'The dog wagged <strong>its</strong> tail.'</em> (The tail belonging to it)" },
    { title: "Vocabulary: 'Meticulous'", content: "Meaning: Showing great attention to detail; very careful and precise.<br>Example: <em>'He was <strong>meticulous</strong> in his planning for the event.'</em>" },
    // --- Add 20 more lessons below ---
    { title: "Phrasal Verb: 'Give up'", content: "Meaning: To stop trying; to surrender.<br>Example: <em>'Don't <strong>give up</strong> on your dreams!'</em>" },
    { title: "Pronunciation: Silent 'L'", content: "Some words have a silent 'L', like: <strong>ca</strong>l<strong>m</strong>, <strong>wa</strong>l<strong>k</strong>, <strong>ta</strong>l<strong>k</strong>, <strong>ha</strong>l<strong>f</strong>, <strong>cou</strong>l<strong>d</strong>, <strong>shou</strong>l<strong>d</strong>." },
    { title: "Grammar: Comparatives", content: "Use '-er' for short adjectives (e.g., tall<strong>er</strong>), 'more' for longer adjectives (e.g., <strong>more</strong> beautiful).<br>Example: <em>'She is tall<strong>er</strong> than her brother.'</em><br>Example: <em>'This book is <strong>more</strong> interesting than the last one.'</em>" },
    { title: "Idiom: 'Piece of cake'", content: "Meaning: Something very easy to do.<br>Example: <em>'The exam was a <strong>piece of cake</strong>.'</em>" },
    { title: "Vocabulary: 'Resilient'", content: "Meaning: Able to withstand or recover quickly from difficult conditions.<br>Example: <em>'Children are often surprisingly <strong>resilient</strong>.'</em>" },
    { title: "Common Mistake: 'Affect' vs 'Effect'", content: "<strong>Affect</strong> is usually a verb (to influence).<br><strong>Effect</strong> is usually a noun (a result).<br>Example: <em>'The rain will <strong>affect</strong> the picnic.'</em><br>Example: <em>'The rain had a negative <strong>effect</strong> on the picnic.'</em>" },
    { title: "Phrasal Verb: 'Run out of'", content: "Meaning: To use all of something and have no more left.<br>Example: <em>'We've <strong>run out of</strong> milk.'</em>" },
    { title: "Vocabulary: 'Ambiguous'", content: "Meaning: Open to more than one interpretation; having a double meaning; unclear.<br>Example: <em>'The instructions were <strong>ambiguous</strong>, so I wasn't sure what to do.'</em>" },
    { title: "Idiom: 'Hit the nail on the head'", content: "Meaning: To describe exactly what is causing a situation or problem; to be exactly right.<br>Example: <em>'You <strong>hit the nail on the head</strong> when you said the issue was communication.'</em>" },
    { title: "Grammar: Articles 'A', 'An', 'The'", content: "Use <strong>a</strong> before consonant sounds (a cat), <strong>an</strong> before vowel sounds (an apple). Use <strong>the</strong> for specific or already mentioned items.<br>Example: <em>'I saw <strong>a</strong> dog. <strong>The</strong> dog was friendly.'</em>" },
    { title: "Vocabulary: 'Conundrum'", content: "Meaning: A confusing and difficult problem or question.<br>Example: <em>'Arranging childcare is a real <strong>conundrum</strong> for working parents.'</em>" },
    { title: "Pronunciation: '-ed' Endings", content: "The '-ed' ending can sound like /t/ (walk<strong>ed</strong>), /d/ (liv<strong>ed</strong>), or /ɪd/ (want<strong>ed</strong>, need<strong>ed</strong>).<br>Rule: /ɪd/ after 't' or 'd' sounds. /t/ after voiceless sounds (p, k, s, f, sh, ch, th). /d/ after voiced sounds (b, g, v, z, l, m, n, r, vowels)." },
    { title: "Phrasal Verb: 'Put off'", content: "Meaning: To postpone; to delay doing something.<br>Example: <em>'I keep <strong>putting off</strong> going to the dentist.'</em>" },
    { title: "Idiom: 'Under the weather'", content: "Meaning: Slightly unwell or sick.<br>Example: <em>'I'm feeling a bit <strong>under the weather</strong> today.'</em>" },
    { title: "Vocabulary: 'Gregarious'", content: "Meaning: Fond of company; sociable.<br>Example: <em>'He was a popular and <strong>gregarious</strong> man.'</em>" },
    { title: "Common Mistake: 'Who' vs 'Whom'", content: "Use <strong>who</strong> for the subject of a verb. Use <strong>whom</strong> for the object of a verb or preposition. (Tip: If you can replace it with 'he/she', use 'who'. If you can replace it with 'him/her', use 'whom'.)<br>Example: <em>'<strong>Who</strong> is coming?'</em> (He is coming)<br>Example: <em>'To <strong>whom</strong> should I give this?'</em> (Give this to him)" },
    { title: "Grammar: Conditional (Type 1)", content: "Used for real possibilities in the future.<br>Form: <code>If + present simple, ... will + base verb</code><br>Example: <em>'If it <strong>rains</strong> tomorrow, we <strong>will stay</strong> inside.'</em>" },
    { title: "Vocabulary: 'Ephemeral'", content: "Meaning: Lasting for only a short time; transitory.<br>Example: <em>'Fashion trends are often <strong>ephemeral</strong>.'</em>" },
    { title: "Idiom: 'Cost an arm and a leg'", content: "Meaning: To be very expensive.<br>Example: <em>'That new car must have <strong>cost an arm and a leg</strong>!'</em>" },
    { title: "Phrasal Verb: 'Figure out'", content: "Meaning: To understand or solve something.<br>Example: <em>'I need to <strong>figure out</strong> how to use this software.'</em>" }
];

let lastLessonIndex = -1; // Keep track of the last lesson shown

function displayRandomLesson() {
    // Clear any previous timer
    clearInterval(timerInterval);
    progressBar.style.width = '0%'; // Reset progress bar visually

    // Select a random lesson different from the last one (if possible)
    let randomIndex;
    if (lessons.length > 1) {
        do {
            randomIndex = Math.floor(Math.random() * lessons.length);
        } while (randomIndex === lastLessonIndex);
    } else {
        randomIndex = 0; // Handle case with only one lesson
    }
    lastLessonIndex = randomIndex;

    const selectedLesson = lessons[randomIndex];

    // Update title and content
    lessonTitle.textContent = selectedLesson.title;
    lessonTitle.classList.remove('clickable'); // Make it look less clickable while active
    lessonTitle.classList.add('active');
    lessonContent.innerHTML = selectedLesson.content; // Use innerHTML to render <br>, <strong> etc.

    // Start the timer and progress bar
    let startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min((elapsedTime / timerDuration) * 100, 100); // Cap at 100%
        progressBar.style.width = progress + '%';

        if (elapsedTime >= timerDuration) {
            clearInterval(timerInterval);
            lessonTitle.textContent = "Time's up! Click for another lesson.";
            lessonTitle.classList.add('clickable'); // Make clickable again
             lessonTitle.classList.remove('active');
            // Optional: Clear content after timer ends
            // lessonContent.innerHTML = '<p class="instructions">Click the title above for a new lesson.</p>';
        }
    }, 100); // Update progress bar every 100ms
}

// Add event listener to the title
lessonTitle.addEventListener('click', displayRandomLesson);

// Initial state message
lessonContent.innerHTML = '<p class="instructions">Click the title above to start. A new random lesson will appear, and the timer will begin.</p>';
