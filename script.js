$(document).ready(function() {
    // --- Configuration ---
    const MAX_JOB_SEEKERS = 5;
    const PAID_HOUR_MESSAGE = "You'll get paid for the first hour after you sign up and are selected!";

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
                <div class="seeker-card" id="seeker-${this.id}">
                    <h3>${this.name}</h3>
                    <p><strong>Email:</strong> ${this.email}</p>
                    <p><strong>Skills:</strong> ${this.skills.join(', ')}</p>
                    <p><small>Registered: ${this._registrationDate.toLocaleDateString()}</small></p>
                </div>
            `;
        }
    }

    /**
     * Manages the list of job seekers.
     */
    class JobSeekerList {
        constructor() {
            this._seekers = []; // "Private" convention for the list of seekers
            this._loadSeekers(); // Load seekers from local storage if available
        }

        // Simulates loading seekers (e.g., from localStorage or a db)
        _loadSeekers() {
            const storedSeekers = localStorage.getItem('jobSeekers');
            if (storedSeekers) {
                try {
                    const parsedSeekers = JSON.parse(storedSeekers);
                    // Re-instantiate objects to retain class methods
                    this._seekers = parsedSeekers.map(s => {
                        const seeker = new JobSeeker(s.name, s.email, s.skills);
                        seeker.id = s.id; // Preserve original ID
                        seeker._registrationDate = new Date(s._registrationDate); // Preserve date
                        return seeker;
                    });
                } catch (e) {
                    console.error("Error loading seekers from localStorage:", e);
                    this._seekers = [];
                }
            }
        }

        // Simulates saving seekers
        _saveSeekers() {
            localStorage.setItem('jobSeekers', JSON.stringify(this._seekers));
        }

        /**
         * Adds a job seeker to the list if not full.
         * @param {JobSeeker} seeker - The job seeker object.
         * @returns {boolean} True if added, false if list is full.
         */
        addSeeker(seeker) {
            if (this._seekers.length < MAX_JOB_SEEKERS) {
                this._seekers.push(seeker);
                this._saveSeekers(); // Save after adding
                return true;
            }
            return false;
        }

        /**
         * Gets the current list of job seekers.
         * @returns {JobSeeker[]}
         */
        getSeekers() {
            return [...this._seekers]; // Return a copy
        }

        /**
         * Gets the count of current job seekers.
         * @returns {number}
         */
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

    // Function to render job seekers to the page
    function renderJobSeekers() {
        $jobSeekersListDiv.empty(); // Clear existing list
        const seekers = jobSeekerList.getSeekers();
        if (seekers.length === 0) {
            $jobSeekersListDiv.html('<p>No candidates have signed up yet. Be the first!</p>');
        } else {
            seekers.forEach(seeker => {
                $jobSeekersListDiv.append(seeker.getCardHtml());
            });
        }
        updateSignupSectionVisibility();
    }

    // Function to handle form submission (simulated AJAX)
    function handleSignupSubmit(event) {
        event.preventDefault(); // Prevent actual form submission

        if (jobSeekerList.isFull()) {
            $signupMessage.text('Sorry, we are not accepting more applications at the moment.').css('color', 'red');
            $signupForm.hide();
            return;
        }

        const name = $('#name').val().trim();
        const email = $('#email').val().trim();
        const skillsRaw = $('#skills').val().trim();

        if (!name || !email || !skillsRaw) {
            $signupMessage.text('Please fill in all fields.').css('color', 'red');
            return;
        }

        const skills = skillsRaw.split(',').map(skill => skill.trim()).filter(skill => skill);

        if (skills.length === 0) {
            $signupMessage.text('Please list at least one skill.').css('color', 'red');
            return;
        }
        
        // Simulate AJAX call
        $signupMessage.text('Submitting your application...').css('color', 'blue');
        // Disable button during "submission"
        $signupForm.find('button[type="submit"]').prop('disabled', true);

        setTimeout(() => { // Simulate network delay
            const newSeeker = new JobSeeker(name, email, skills);
            const added = jobSeekerList.addSeeker(newSeeker);

            if (added) {
                renderJobSeekers();
                $signupMessage.html(`Welcome, ${name}! ${PAID_HOUR_MESSAGE}`).css('color', 'green');
                $signupForm[0].reset(); // Clear the form
            } else {
                // This case should ideally be caught by isFull() check earlier,
                // but as a fallback:
                $signupMessage.text('Application limit reached. Could not add your application.').css('color', 'red');
            }
            // Re-enable button
            $signupForm.find('button[type="submit"]').prop('disabled', false);
            updateSignupSectionVisibility();

        }, 1000); // 1 second delay
    }
    
    // Update visibility of signup form based on seeker count
    function updateSignupSectionVisibility() {
        if (jobSeekerList.isFull()) {
            $('#signup-section h2').text('Applications Closed');
            $signupForm.hide();
            if ($jobSeekersListDiv.find('.seeker-card').length >= MAX_JOB_SEEKERS) {
                 $signupMessage.text(`We have reached our maximum of ${MAX_JOB_SEEKERS} candidates. Thank you for your interest!`).css('color', 'orange');
            }
        } else {
            $('#signup-section h2').text('Join Us!');
            $signupForm.show();
             // Clear any "limit reached" messages if form is shown again
            if ($signupMessage.text().includes("maximum")) {
                $signupMessage.text('');
            }
        }
        // Display the general "paid hour" message if not showing a specific status message
        if ($signupMessage.text() === '' || $signupMessage.text().includes(PAID_HOUR_MESSAGE)) {
             const availableSlots = MAX_JOB_SEEKERS - jobSeekerList.getSeekerCount();
             if (availableSlots > 0) {
                $signupMessage.html(`Sign up now! ${availableSlots} spot(s) remaining. ${PAID_HOUR_MESSAGE}`).css('color', 'blue');
             } else if (!$signupMessage.text().includes("maximum")) { // Only if not already showing max message
                $signupMessage.text(PAID_HOUR_MESSAGE).css('color', 'blue');
             }
        }
    }


    // --- Initialization ---
    $signupForm.on('submit', handleSignupSubmit);
    renderJobSeekers(); // Initial render of job seekers from localStorage (if any)
    // Initial message update
    if(jobSeekerList.getSeekerCount() === 0 && !jobSeekerList.isFull()){
        $signupMessage.html(`Sign up now! ${MAX_JOB_SEEKERS} spot(s) remaining. ${PAID_HOUR_MESSAGE}`).css('color', 'blue');
    }

});
