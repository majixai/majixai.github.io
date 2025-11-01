import pandas as pd
from datetime import datetime

def generate_report():
    try:
        df = pd.read_csv('click_data.csv')

        # The Google Sheet might not have a header row initially, so name the columns
        df.columns = ['Timestamp', 'TargetURL', 'Referrer', 'UserAgent', 'EventType']

        # Fill missing EventType values with 'click' for backward compatibility
        df['EventType'].fillna('click', inplace=True)

        # Extract project name from the TargetURL
        # Example URL: https://majixai.github.io/best/performers/
        # We want to capture 'best/performers'
        df['Project'] = df['TargetURL'].apply(lambda url: '/'.join(url.split('/')[3:5]).strip('/') if len(url.split('/')) > 4 else 'N/A')

        # Separate clicks and visits
        clicks_df = df[df['EventType'] == 'click']
        visits_df = df[df['EventType'] == 'page_visit']

        # Calculate counts
        click_counts = clicks_df['Project'].value_counts().reset_index()
        click_counts.columns = ['Project', 'Clicks']

        visit_counts = visits_df['Project'].value_counts().reset_index()
        visit_counts.columns = ['Project', 'Visits']

        # Merge the two dataframes
        if not click_counts.empty and not visit_counts.empty:
            merged_counts = pd.merge(click_counts, visit_counts, on='Project', how='outer')
        elif not click_counts.empty:
            merged_counts = click_counts
            merged_counts['Visits'] = 0
        elif not visit_counts.empty:
            merged_counts = visit_counts
            merged_counts['Clicks'] = 0
        else:
            merged_counts = pd.DataFrame(columns=['Project', 'Clicks', 'Visits'])


        merged_counts.fillna(0, inplace=True)
        merged_counts['Clicks'] = merged_counts['Clicks'].astype(int)
        merged_counts['Visits'] = merged_counts['Visits'].astype(int)


        with open('CLICK_ANALYTICS.md', 'w') as f:
            f.write("# Daily Click and Visit Analytics Report\n\n")
            f.write("This report is generated daily and shows the number of clicks on README links and visits to project pages.\n\n")
            f.write("## Analytics per Project\n\n")
            if not merged_counts.empty:
                f.write(merged_counts.to_markdown(index=False))
            else:
                f.write("No analytics data available yet.")
            f.write("\n\n")
            f.write(f"_Data last updated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}_")

    except Exception as e:
        print(f"Error generating report: {e}")
        with open('CLICK_ANALYTICS.md', 'w') as f:
            f.write("# Daily Click and Visit Analytics Report\n\n")
            f.write(f"Error generating report: {e}\n\n")
            f.write(f"_Data last updated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}_")

if __name__ == "__main__":
    generate_report()
