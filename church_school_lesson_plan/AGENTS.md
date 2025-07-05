# AGENTS.md - Church School Lesson Plan Structure for Mrs. Scott (Ages 6-7)

This directory contains a structured set of HTML templates and guidelines designed to assist **Mrs. Scott** in developing a rich and engaging church school lesson plan curriculum. It is specifically tailored for children aged 6-7 years old. All templates are styled with W3.CSS (linked via CDN) for better visual presentation when viewed in a web browser.

## Core Philosophy: Teacher Autonomy & Adaptability

*   **Mrs. Scott is the Curriculum Shaper:** These templates provide a robust framework, not a rigid script. Mrs. Scott has the final say on all lesson content, adapting it to the unique needs of her students and the specific goals of her ministry.
*   **Full Editability:** All HTML template files are fully editable. Mrs. Scott should feel empowered to modify, add, or remove content to suit her specific needs, theological emphases, church traditions, and the insights she gains from her students.
*   **Audience Analysis is Key:** Each school year brings a unique group of children. **It is crucial for Mrs. Scott to adapt lesson plans based on an initial and ongoing analysis of her students.** This includes understanding their developmental stages (within the 6-7 range), prior knowledge, interests, learning styles, and any specific needs. This analysis will guide her choice of stories, activities, pacing, and complexity.
*   **Populate to Create Your Semester/Year:** This structure is designed for Mrs. Scott to populate with her detailed lesson plans, stories, activities, and resources, building out a full semester's or year's worth of material. The "length" and richness of the overall lesson plan system will grow significantly as she does this.

## How to Use This Structure:

1.  **Understand the File Format:** All primary templates are `.html` files. Mrs. Scott can open them in a web browser to view their styled layout or open them in a text editor (or HTML editor) to modify their content.
    *   Styling is provided by W3.CSS, linked from a CDN in the `<head>` of each HTML file.

2.  **Understand the Age Focus:** All materials and templates are designed for 6-7 year olds. Activities should be hands-on, engaging, and relatively short. Concepts should be concrete and relatable. Language should be simple.

3.  **Start with the Big Picture (`yearly_overview_template.html`, `school_year_structure_considerations.html`, `subject_areas_overview.html`):**
    *   Use `lesson_calendars/yearly_overview_template.html` to map out major themes, units, holidays, and term dates for the entire year. This provides a high-level roadmap.
    *   Review `school_year_structure_considerations.html` for further guidance on structuring terms and pacing.
    *   Consult `subject_materials/subject_areas_overview.html` to understand the recommended subjects. Mrs. Scott should prioritize and expand on subjects according to her specific educational goals and available class time.

4.  **Monthly and Weekly Planning (using `lesson_calendars/` templates):**
    *   **Monthly View:** Copy `lesson_calendars/monthly_calendar_template.html` (e.g., to `lesson_calendars/september_2024_calendar.html`). Mrs. Scott can then fill in this calendar with:
        *   Lesson titles or brief summaries for each class day.
        *   Direct links to her specific daily lesson plan files (see next point).
        *   Notes for holidays or special events occurring that month.
    *   **Weekly View:** Copy `lesson_calendars/weekly_calendar_template.html` (e.g., `lesson_calendars/week_of_sept_9_2024_calendar.html`). This template allows for more detail for each day of the week, such as:
        *   Lesson Title / Theme for the day.
        *   Key Activities / Focus Points.
        *   Scripture Focus.
        *   Key Materials needed.
        *   A direct link to the full Daily Lesson Plan file.
    *   These calendar views help organize the flow of lessons and provide an at-a-glance overview.

5.  **Detailed Daily Lesson Planning (`daily_schedules/sample_daily_schedule_template.html`):**
    *   This is the core template for planning each individual class session (1.5 to 6 hours long).
    *   Mrs. Scott should copy this template for each class day (e.g., `daily_schedules/lesson_plan_sept_9_2024.html`) and fill it with specific timings, activities, Bible stories, literacy/numeracy focuses, crafts, music, etc., tailored to that day's objectives and her students' needs.
    *   The information from these detailed daily plans can then be summarized or linked in the weekly/monthly calendar views.

6.  **Developing Subject Content (`subject_materials/subject_unit_template.html`):**
    *   For each thematic unit or extended study on a particular subject (e.g., a 4-week unit on Moses), Mrs. Scott should use the `subject_unit_template.html`. This helps detail:
        *   Learning objectives (adapted for her current students).
        *   Lesson breakdowns and activities (chosen for engagement).
        *   Required resources, assessment ideas, and cross-curricular integration.
        *   Differentiation notes for diverse learners.

7.  **Classroom Management Resources (`classroom_management_resources/`):**
    *   `attendance_sheet_template.html`: For tracking daily/weekly attendance.
    *   `group_management_template.html`: To help organize students for group work.
    *   `emergency_contact_form_template.html`: **Crucial for student safety.**
        *   **VERY IMPORTANT, MRS. SCOTT:** This form collects sensitive personal data. Ensure it is printed, completed by parents/guardians, and then **stored securely and confidentially** according to your church's privacy and child safety policies. Digital storage of completed forms within this general folder structure is **not recommended** unless the environment is specifically secured for such private data.

8.  **Assessment (`assessments/`):**
    *   Consult `grading_and_feedback_philosophy.html` for principles on age-appropriate assessment, including notes on observing holistic development and skills relevant to "life roles." Mrs. Scott's role is to provide opportunities for growth and to observe, not to make definitive judgments about a child's entire future based on these early years.
    *   `student_grades_template.html`: A styled template for manually recording observations, participation, and results from various assessments. This is for Mrs. Scott's interpretation of student work and progress.
    *   Other templates: `quiz_template.html`, `midterm_review_ideas.html`, `final_project_ideas_template.html`.
    *   Remember, assessment for this age group should be primarily informal, observational, and encouraging.

9.  **Projects, Events, Extras (`projects/`, `events_and_awards/`, `homework_optional/`, `story_resources/`):**
    *   Utilize templates like `project_outline_template.html`, `annual_events_calendar_template.html`, `field_trip_planning_template.html`, `weekly_prize_system.html`, and `homework_classwork_ideas.html` as needed.
    *   The story `story_resources/the_little_helping_seed.html` is provided as an example resource. Mrs. Scott can add more stories or link to external ones.

## Expanding This Structure:

*   **Populate with Specific Content:** Mrs. Scott's main task will be to take these HTML templates, save copies (e.g., `unit_moses_overview.html`, `daily_lesson_oct5.html`), and fill them with her specific Bible stories, chosen activities, resource lists, etc. The more detailed she makes these, the more "lengthy" and valuable the overall system becomes.
*   **Create Subfolders:** For better organization, especially within `subject_materials/` or `daily_schedules/`, Mrs. Scott might create subfolders for terms, months, or specific units (e.g., `subject_materials/advent_unit/`, `daily_schedules/fall_term/`).
*   **Add Resource Lists:** Consider creating separate HTML files for comprehensive lists of recommended books, songs, websites, or craft supply sources.
*   **Visuals:** Note visual aid needs in lesson plans. Digital copies of printables or links to online images can be stored in relevant folders or linked from plans. More extensive art can be added to the site or individual pages later by editing the HTML.

## Key Considerations for 6-7 Year Olds (Reiteration):

*   **Active Learning:** Incorporate movement, songs, games, hands-on activities.
*   **Storytelling:** Bible stories are central. Use engaging techniques.
*   **Repetition:** Beneficial for young children.
*   **Positive Reinforcement:** Encourage participation and effort.
*   **Flexibility:** Crucial! Be prepared to adapt lessons based on children's responses and needs – this is where Mrs. Scott's ongoing audience analysis is vital.
*   **Faith Integration:** Continuously connect lessons back to God's love and Christian values.

This framework is intended to be a helpful and flexible starting point for Mrs. Scott. May God bless your ministry to the children!
