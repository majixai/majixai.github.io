import subprocess
import re

def get_recent_commits(n=5):
    """Fetches the last n commit details from git log."""
    try:
        # Using a custom format to easily parse the details
        # %h: abbreviated hash, %ad: author date, %an: author name, %s: subject
        format_str = "%h -- %ad -- %an -- %s"
        date_format = "--date=format:%Y-%m-%d"
        command = f"git log -n {n} --pretty=format:'{format_str}' {date_format}"

        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        return result.stdout.strip().split('\n')
    except subprocess.CalledProcessError as e:
        print(f"Error fetching git log: {e}")
        return []

def update_readme(commits):
    """Updates the README.md file with the list of recent commits."""
    start_marker = "<!-- START_RECENT_ACTIVITY -->"
    end_marker = "<!-- END_RECENT_ACTIVITY -->"

    try:
        with open("README.md", "r") as f:
            readme_content = f.read()

        # Create the markdown list of commits
        commit_list_md = "\n".join([f"- {commit}" for commit in commits])

        # Use regex to find and replace the content between the markers
        # The re.DOTALL flag allows the '.' to match newlines
        new_content = re.sub(
            f"({re.escape(start_marker)})(.*?)({re.escape(end_marker)})",
            f"\\1\n{commit_list_md}\n\\3",
            readme_content,
            flags=re.DOTALL
        )

        with open("README.md", "w") as f:
            f.write(new_content)

    except FileNotFoundError:
        print("Error: README.md not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    # Main execution
    recent_commits = get_recent_commits()
    if recent_commits:
        update_readme(recent_commits)
        print("README.md updated successfully with recent commits.")