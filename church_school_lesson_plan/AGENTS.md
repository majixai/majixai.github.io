# AGENTS.md - Church School Lesson Plan Structure for Mrs. Scott

This directory contains a structured set of HTML templates and guidelines designed to assist **Mrs. Scott** in developing a rich and engaging church school lesson plan curriculum. It now caters to **two main class groups with differentiated age sub-groups**:
*   **Class 1: Ages 2-5** (with considerations for 2-3 year olds vs. 4-5 year olds)
*   **Class 2: Ages 5-8** (with considerations for 5-6 year olds vs. 7-8 year olds - note the overlap with the original 6-7 focus, now expanded)

All templates are styled with W3.CSS (linked via CDN) and the "Cardinal Red 4 Kids!" theme for better visual presentation. The Youth School Logo is now integrated into the header of all HTML pages for consistent branding.

## Core Philosophy: Teacher Autonomy & Adaptability

*   **Mrs. Scott is the Curriculum Shaper:** These templates provide a robust framework, not a rigid script. Mrs. Scott has the final say on all lesson content, adapting it to the unique needs of her students and the specific goals of her ministry.
*   **Full Editability:** All HTML template files are fully editable. Mrs. Scott should feel empowered to modify, add, or remove content to suit her specific needs, theological emphases, church traditions, and the insights she gains from her students.
*   **Audience Analysis & Age Differentiation is Key:** Each school year brings unique groups of children across a wider age span.
    *   **It is crucial for Mrs. Scott to adapt lesson plans based on an initial and ongoing analysis of her students within their specific age sub-groups (2-3, 4-5, 5-6, 7-8).**
    *   This includes understanding their developmental stages, prior knowledge, attention spans, interests, learning styles, and any specific needs.
    *   This analysis will guide her choice of stories, activities, pacing, complexity of concepts, and expected responses.
    *   Key templates (`sample_daily_schedule_template.html`, `subject_unit_template.html`, and assessment templates) will be updated to include sections or prompts for this differentiation.
*   **Populate to Create Your Curriculum:** This structure is designed for Mrs. Scott to populate with her detailed lesson plans, age-specific story adaptations, activities, and resources, building out a full curriculum for all her age groups.

## How to Use This Structure:

1.  **Understand the File Format & Theme:** All primary templates are `.html` files, styled with W3.CSS and the "Cardinal Red 4 Kids!" theme. The Youth School Logo is in the header of each page.

2.  **NEW: Focus on Age Groups:**
    *   **Class 1: 2-5 Year Olds**
        *   **2-3 Year Olds:** Focus on sensory experiences, very short stories (board book style), simple songs with actions, basic concepts (God made me, God loves me), parallel play, very short attention spans. Activities should be simple, safe, and tactile.
        *   **4-5 Year Olds:** Can handle slightly longer stories, more interactive songs and games, simple crafts, basic Bible story recall, emerging cooperative play. Begin introducing simple Christian values through stories.
    *   **Class 2: 5-8 Year Olds**
        *   **5-6 Year Olds:** (Similar to the original 6-7 focus) Can engage with more detailed Bible stories, begin simple reading/writing connections (if applicable), participate in group discussions, more complex crafts and games.
        *   **7-8 Year Olds:** Capable of deeper understanding of Bible narratives, exploring character motivations, more complex moral dilemmas (simplified), independent reading/writing activities, longer projects, and more abstract thinking about faith concepts.
    *   Mrs. Scott will need to use the new sections in the templates to plan distinct approaches for these groups.

3.  **Start with the Big Picture (Yearly & Term Planning):**
    *   Use `lesson_calendars/yearly_overview_template.html` to map out major themes and Bible story arcs for the entire year, considering how they might be introduced or deepened across the different age groups.
    *   Review `school_year_structure_considerations.html` for guidance on structuring terms.
    *   Consult `subject_materials/subject_areas_overview.html` for subject scopes, now considering how each subject translates to the different age capabilities.

4.  **Monthly and Weekly Planning (using `lesson_calendars/` templates):**
    *   Copy and populate `monthly_calendar_template.html` and `weekly_calendar_template.html` for each class or for combined planning if themes overlap.
    *   In the day cells, Mrs. Scott should note the core lesson topic and then perhaps briefly indicate the different activity focuses for the age sub-groups or link to a daily plan that details this.

5.  **Detailed Daily Lesson Planning (`daily_schedules/sample_daily_schedule_template.html`):**
    *   **CRITICAL FOR AGE DIFFERENTIATION:** This template will be updated to include specific placeholder sections within each time slot/activity block for:
        *   `Activity/Focus for 2-3 Year Olds:`
        *   `Activity/Focus for 4-5 Year Olds:`
        *   `Activity/Focus for 5-6 Year Olds:`
        *   `Activity/Focus for 7-8 Year Olds:`
    *   Mrs. Scott will use these to detail how a single Bible story or theme is presented and interacted with differently by each age group during the 1.5 to 6-hour class time.

6.  **Developing Subject Content & Units (`subject_materials/subject_unit_template.html`):**
    *   **CRITICAL FOR AGE DIFFERENTIATION:** This template will be updated to prompt for:
        *   Differentiated Learning Objectives for each age sub-group.
        *   Age-specific activity ideas and resource adaptations.
        *   Varied assessment approaches suitable for each age group.

7.  **NEW: Bible Story Summaries with Age Adaptation Prompts (`story_resources/`):**
    *   Six new HTML files (e.g., `01_creation_fall_summary.html`) will provide high-level summaries of key Bible narrative arcs.
    *   Each summary will include specific placeholder sections for Mrs. Scott to develop:
        *   `Key Concepts & Sensory Activities for 2-3 yo:`
        *   `Simplified Story & Craft for 4-5 yo:`
        *   `Core Story & Discussion for 5-6 yo:`
        *   `Deeper Dive, Questions & Application for 7-8 yo:`
    *   These are starting points for Mrs. Scott to build out the actual age-appropriate story content.

8.  **Classroom Management Resources (`classroom_management_resources/`):**
    *   Templates for attendance, group management, and emergency contacts remain relevant. Remember the security note for emergency contacts.

9.  **Assessment (`assessments/`):**
    *   Consult `grading_and_feedback_philosophy.html`.
    *   **AGE DIFFERENTIATION NOTE:** Assessment templates (`quiz_template.html`, etc.) will now include a more prominent reminder to significantly adapt any assessment tasks for the varying developmental levels of the 2-8 year old range. For 2-3 year olds, assessment is almost purely observational. For 7-8 year olds, simple written responses or more complex project evaluations might be appropriate.

10. **Events, Awards & Extras (`events_and_awards/`):**
    *   A new `party_planning_template.html` will be added.
    *   Other templates (`annual_events_calendar_template.html`, `field_trip_planning_template.html`, etc.) should be used with age-appropriateness in mind for any planned activities.

11. **Expanding This Structure:**
    *   The core task for Mrs. Scott remains to populate these templates with specific, **age-differentiated content**. This will naturally "lengthen the source" and create a truly comprehensive curriculum.
    *   Consider creating distinct copies of daily or unit plans for each major age class (2-5 and 5-8) if the differentiation becomes very extensive, rather than trying to fit all variations into one document.

## Key Considerations for Differentiated Age Groups:

*   **2-3 Year Olds:** Short attention span, sensory learning, simple language, repetition, parallel play, basic motor skills. Focus: God made me, God loves me, Jesus loves me.
*   **4-5 Year Olds:** Growing attention, love stories, imaginative play, can follow 2-3 step instructions, developing fine motor skills, basic moral understanding (sharing, kindness). Focus: Simple Bible stories, core characters, God is good.
*   **5-6 Year Olds:** Longer attention, can recall story details, understand sequences, simple discussions, group games, developing reading/writing interest. Focus: Key Bible narratives, applying values, simple prayer.
*   **7-8 Year Olds:** Can understand more complex narratives and concepts, ask deeper questions, work more independently, read and write simple sentences/paragraphs, capable of more complex projects. Focus: Understanding God's plan, character studies, personal application of faith.

This updated framework aims to provide Mrs. Scott with the tools to create a truly tailored and developmentally appropriate curriculum for all children in her care. May God bless this expanded ministry!
