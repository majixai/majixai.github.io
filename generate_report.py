import pandas as pd
from datetime import datetime

def generate_report():
    try:
        df = pd.read_csv('click_data.csv')
        # The TargetURL contains the full URL, so we need to extract the project name
        df['Project'] = df['TargetURL'].apply(lambda url: url.split('/')[3] if len(url.split('/')) > 3 else 'N/A')
        click_counts = df['Project'].value_counts().reset_index()
        click_counts.columns = ['Project', 'Clicks']

        with open('CLICK_ANALYTICS.md', 'w') as f:
            f.write("# Daily Click Analytics Report\n\n")
            f.write("This report is generated daily and shows the number of clicks on the links in the README.md file.\n\n")
            f.write("## Clicks per Project\n\n")
            f.write(click_counts.to_markdown(index=False))
            f.write("\n\n")
            f.write(f"_Data last updated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}_")

    except Exception as e:
        print(f"Error generating report: {e}")
        # Create a placeholder report on error
        with open('CLICK_ANALYTICS.md', 'w') as f:
            f.write("# Daily Click Analytics Report\n\n")
            f.write("Error generating report.\n\n")
            f.write(f"_Data last updated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}_")

if __name__ == "__main__":
    generate_report()