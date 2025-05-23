$(document).ready(function() {
    // --- Configuration ---
    const MAX_JOB_SEEKERS = 5;
    const PAID_HOUR_MESSAGE = "You'll get paid for the first hour after you sign up and are selected!";

    // SVGs for cards
    const svgEmailIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-envelope-fill me-2" viewBox="0 0 16 16"><path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555zM0 4.697v7.104l5.803-3.558L0 4.697zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757zm3.436-.586L16 11.801V4.697l-5.803 3.558z"/></svg>`;
    const svgSkillsIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-tools me-2" viewBox="0 0 16 16"><path d="M1 0 0 1l2.2 3.081a1 1 0 0 0 .815.419h.07a1 1 0 0 1 .708.293l2.675 2.675-2.617 2.654A3.003 3.003 0 0 0 0 13a3 3 0 1 0 5.878-.851l2.654-2.617.968.968-.305.914a1 1 0 0 0 .242 1.023l3.356 3.356a1 1 0 0 0 1.414 0l1.586-1.586a1 1 0 0 0 0-1.414l-3.356-3.356a1 1 0 0 0-1.023-.242L10.5 9.5l-.96-.96 2.68-2.643A3.005 3.005 0 0 0 16 3c0-.269-.035-.53-.102-.777l-2.14 2.141L12 3l-.488-.488c-.152-.152-.304-.305-.456-.457L11.5 2l-.488-.488c-.152-.152-.304-.305-.456-.457L10.5 1l-.488-.488c-.152-.152-.304-.305-.456-.457L9.5 0l-.488-.488C8.86 0 8.708 0 8.556 0L8 0l-.488-.488C7.36 0 7.208 0 7.056 0L6.5 0 6 0l-.488-.488C5.36 0 5.208 0 5.056 0L4.5 0 4 0l-.488-.488C3.36 0 3.208 0 3.056 0L2.5 0 2 0l-.488-.488C1.36 0 1.208 0 1.056 0H1zm3.928 1.116A2.003 2.003 0 0 1 7.488 3H13.5V1.5h-1v-1h1v1h.5V0h-1v.5H12v1H7.488a2.003 2.003 0 0 1-2.05-1.884L4.25 1H1.75L4.928 1.116z"/></svg>`;

    // --- OOP Implementation ---

    /**
     * Represents a single job seeker.
     * @param {string} name - The name of the job seeker.
     * @param {string} email - The email of the job seeker.
     * @param {string[]} skills - An array of skills.
     */
    class JobSeeker {
        constructor(name, email, skills) {
            this.id = Date.now().toString(); // Simple unique ID
            this.name = name;
            this.email = email;
            this.skills = skills;
            this._registrationDate = new Date(); // "Private" convention
        }

        // Method to get a displayable HTML card for the seeker
        getCardHtml() {
            return `
                <div class="card seeker-card mb-3 new-seeker-card-animation shadow-sm" id="seeker-${this.id}">
                    <div class="card-body">
                        <h5 class="card-title">${this.name}</h5>
                        <p class="card-text">${svgEmailIcon}<strong>Email:</strong> ${this.email}</p>
                        <p class="card-text">${svgSkillsIcon}<strong>Skills:</strong> ${this.skills.join(', ')}</p>
                        <p class="card-text"><small class="text-muted">Registered: ${this._registrationDate.toLocaleDateString()}</small></p>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Manages the list of job seekers.
     */
    class JobSeekerList {
        constructor() {
            this._seekers = []; 
            this._loadSeekers(); 
        }

        _loadSeekers() {
            const storedSeekers = localStorage.getItem('jobSeekers');
            if (storedSeekers) {
                try {
                    const parsedSeekers = JSON.parse(storedSeekers);
                    this._seekers = parsedSeekers.map(s => {
                        const seeker = new JobSeeker(s.name, s.email, s.skills);
                        seeker.id = s.id; 
                        seeker._registrationDate = new Date(s._registrationDate); 
                        return seeker;
                    });
                } catch (e) {
                    console.error("Error loading seekers from localStorage:", e);
                    this._seekers = [];
                }
            }
        }

        _saveSeekers() {
            localStorage.setItem('jobSeekers', JSON.stringify(this._seekers));
        }

        addSeeker(seeker) {
            if (this._seekers.length < MAX_JOB_SEEKERS) {
                this._seekers.push(seeker);
                this._saveSeekers(); 
                return true;
            }
            return false;
        }

        getSeekers() {
            return [...this._seekers]; 
        }

        getSeekerCount() {
            return this._seekers.length;
        }

        isFull() {
            return this._seekers.length >= MAX_JOB_SEEKERS;
        }
    }

    // --- Application Logic ---
    const jobSeekerList = new JobSeekerList();
    const $jobSeekersListDiv = $('#job-seekers-list');
    const $signupForm = $('#signup-form');
    const $signupMessage = $('#signup-message');

    function renderJobSeekers() {
        $jobSeekersListDiv.empty(); 
        const seekers = jobSeekerList.getSeekers();
        if (seekers.length === 0) {
            $jobSeekersListDiv.html('<p class="text-muted">No candidates have signed up yet. Be the first!</p>');
        } else {
            seekers.forEach(seeker => {
                // Create jQuery object from HTML to apply animation class correctly
                const $seekerCard = $(seeker.getCardHtml());
                $jobSeekersListDiv.append($seekerCard);
                // Remove class after animation to allow re-trigger if element is re-added (though not current behavior)
                // Or simply rely on it for the first appearance.
                // For robust re-animation, one might need to remove and re-add the element or class with a slight delay.
            });
        }
        updateSignupSectionVisibility();
    }

    function handleSignupSubmit(event) {
        event.preventDefault(); 

        if (jobSeekerList.isFull()) {
            $signupMessage.removeClass('alert-success alert-info alert-primary').addClass('alert-warning').html('Sorry, we are not accepting more applications at the moment.');
            $signupForm.addClass('d-none');
            return;
        }

        const name = $('#name').val().trim();
        const email = $('#email').val().trim();
        const skillsRaw = $('#skills').val().trim();

        if (!name || !email || !skillsRaw) {
            $signupMessage.removeClass('alert-success alert-info alert-primary').addClass('alert-danger').html('Please fill in all fields.');
            return;
        }

        const skills = skillsRaw.split(',').map(skill => skill.trim()).filter(skill => skill);

        if (skills.length === 0) {
            $signupMessage.removeClass('alert-success alert-info alert-primary').addClass('alert-danger').html('Please list at least one skill.');
            return;
        }
        
        $signupMessage.removeClass('alert-success alert-danger alert-warning').addClass('alert-info').html('Submitting your application...');
        $signupForm.find('button[type="submit"]').prop('disabled', true);

        setTimeout(() => { 
            const newSeeker = new JobSeeker(name, email, skills);
            const added = jobSeekerList.addSeeker(newSeeker);

            if (added) {
                renderJobSeekers();
                $signupMessage.removeClass('alert-danger alert-info alert-warning').addClass('alert-success').html(`Welcome, ${name}! ${PAID_HOUR_MESSAGE}`);
                $signupForm[0].reset(); 
            } else {
                $signupMessage.removeClass('alert-success alert-info alert-primary').addClass('alert-danger').html('Application limit reached. Could not add your application.');
            }
            $signupForm.find('button[type="submit"]').prop('disabled', false);
            updateSignupSectionVisibility();

        }, 1000); 
    }
    
    function updateSignupSectionVisibility() {
        if (jobSeekerList.isFull()) {
            $('#signup-section h2').text('Applications Closed');
            $signupForm.addClass('d-none');
            // Check if the message isn't already a success message from signup
            if (!$signupMessage.hasClass('alert-success')) {
                 $signupMessage.removeClass('alert-success alert-danger alert-primary').addClass('alert-warning').html(`We have reached our maximum of ${MAX_JOB_SEEKERS} candidates. Thank you for your interest!`);
            }
        } else {
            $('#signup-section h2').text('Join Us!');
            $signupForm.removeClass('d-none');
            // Clear "max candidates" or other general messages if form is shown again,
            // unless it's a success message which should persist briefly.
            if (!$signupMessage.hasClass('alert-success') && ($signupMessage.hasClass('alert-warning') || $signupMessage.text().includes("maximum"))) {
                $signupMessage.removeClass('alert-success alert-danger alert-warning alert-info').addClass('alert-primary').empty(); // Or a default prompt
            }
        }

        // Update general info message if no specific message (like welcome or error) is being shown
        // This logic is a bit complex due to interactions with other messages.
        // If signup message is empty or just a generic primary/info prompt, update it.
        const currentMessageText = $signupMessage.html();
        if (currentMessageText === '' || $signupMessage.hasClass('alert-primary') || ($signupMessage.hasClass('alert-info') && currentMessageText.includes("Submitting"))) {
             const availableSlots = MAX_JOB_SEEKERS - jobSeekerList.getSeekerCount();
             if (availableSlots > 0 && !jobSeekerList.isFull()) {
                $signupMessage.removeClass('alert-success alert-danger alert-warning').addClass('alert-info').html(`Sign up now! ${availableSlots} spot(s) remaining. ${PAID_HOUR_MESSAGE}`);
             } else if (jobSeekerList.isFull() && !$signupMessage.hasClass('alert-success') && !$signupMessage.hasClass('alert-warning')) {
                // This case might be redundant if the above `isFull()` check already set the message
                $signupMessage.removeClass('alert-success alert-danger alert-primary').addClass('alert-warning').html(`We have reached our maximum of ${MAX_JOB_SEEKERS} candidates. Thank you for your interest!`);
             } else if (availableSlots === 0 && !jobSeekerList.isFull() && !$signupMessage.hasClass('alert-success') ) {
                // This state (0 slots, but not full) should ideally not happen with MAX_JOB_SEEKERS = 5
                // but as a fallback, show the paid hour message.
                $signupMessage.removeClass('alert-success alert-danger alert-warning').addClass('alert-info').html(PAID_HOUR_MESSAGE);
             }
        }
    }

    // --- Initialization ---
    $signupForm.on('submit', handleSignupSubmit);
    renderJobSeekers(); 
    // Initial message update
    if(jobSeekerList.getSeekerCount() === 0 && !jobSeekerList.isFull()){
        $signupMessage.removeClass('alert-success alert-danger alert-warning').addClass('alert-info').html(`Sign up now! ${MAX_JOB_SEEKERS} spot(s) remaining. ${PAID_HOUR_MESSAGE}`);
    }
});
