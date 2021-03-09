import JiraClient from 'jira-connector';
import { JIRA_SPRINT_ACTIVE, JIRA_HOST } from './constants/jira.constant';

export {Jira};

class Jira {
    private token:string = '///Your token///';
    jira: JiraClient;
    constructor(_username: string) {
        this.jira = new JiraClient({
            host: JIRA_HOST,
            basic_auth: {
                email: _username,
                api_token: this.token
              }
          });
    }

    public async getIssuesByActiveSprint(_board: number | string,_filter:{ status?: string, jql?: string}):Promise<any[]> {
        try {

            let sprints = await this.jira.board.getAllSprints({
                boardId: _board
            });
            
            sprints = sprints.values.filter((sprint:any) => {
                return sprint.state === JIRA_SPRINT_ACTIVE
            });
            let issues: any = [];
            let jql = '';
            if (_filter.jql) {
                jql = `${_filter.jql}`;
            }
            for(let i=0;i<sprints.length;i++) {
                console.log(`Get sprint id=${sprints[i].id} issues...`);
                const res = await this.jira.sprint.getSprintIssues({
                    sprintId: sprints[i].id,
                    jql: jql,
                    maxResults: 1000
                });
                console.log(`Found ${res.issues.length} issues in sprint id=${sprints[i].id}.`);
                issues = issues.concat(res.issues);
            };
            
            return issues;
            
        } catch (err) {
            console.error(err);
            return err;
        }
    }
}