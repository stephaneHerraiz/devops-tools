import { Table } from 'console-table-printer';
import { gt, gte } from 'semver';
import { Github, repository } from './lib/github/github';
import { Jira } from './lib/jira/jira';
import { Kubernates } from './lib/kubernates/kubernates';

export {issueDeploymentStatus};

const issueDeploymentStatus = async (githubPrivateKey: string, namespaceName: string, board: string, jql?: string) => {
    try {
        const github = new Github(githubPrivateKey);
        await github.init();
        const jira = new Jira('stephane.herraiz@vinci-construction.com');
        const issues = await jira.getIssuesByActiveSprint(board, { jql: jql});
        console.log(`Found ${issues.length} issues with JQL filter : ${jql}`);
        const tableData =  new Table({
            columns: [
              { name: 'Issue ticket', alignment: 'left'}, //with alignment and color
              { name: 'Repository', alignment: 'left' },
              { name: 'Repo version', alignment: 'right' },
              { name: 'Ready', alignment: 'left' }
            ],
          });
        
        const kubernates = new Kubernates();
        await kubernates.init();
        const promoteList : {[key: string]: string} = {};
        for(let i=0; i< issues.length;i++) {
            const issue = issues[i];
            process.stdout.write(`Getting release of ${issue.key} and check ${namespaceName} (${i + 1}/${issues.length})\r`);
            const repos :repository[] = await github.getReleaseByJiraIssue(issue.key, 'digital-site');
            if(repos.length === 0) {
                tableData.addRow({
                    'Issue type': 'issue',
                    'Issue ticket': issue.key,
                    'Repository': `Not found in changelog(s)`,
                    'Repo version': '',
                    'Ready': ''
                }, { color: 'red' });
            } else {
                repos.forEach((repo: repository) => {
                    const release = kubernates.getCurrentRelease(namespaceName, repo.name);
                    let ready = '';
                    if (release) {
                        ready = release && gte(release,repo.release)?'ok':`nok (${release})`;
                        if (!promoteList[`${repo.owner}/${repo.name}`]) {
                            promoteList[`${repo.owner}/${repo.name}`] = repo.release;
                        } else if (promoteList[`${repo.owner}/${repo.name}`] && gt(repo.release,promoteList[`${repo.owner}/${repo.name}`])) {
                            promoteList[`${repo.owner}/${repo.name}`] = repo.release;
                        }
                    }
                    tableData.addRow({
                        'Issue ticket': issue.key,
                        'Repository': `${repo.owner}/${repo.name}`,
                        'Repo version': repo.release,
                        'Ready': ready
                    });
                });
            }
        }
        process.stdout.write(`\r`);
        tableData.printTable();

        console.log(`Promote list for ${namespaceName}:`)
        for (const key in promoteList) {
            if (Object.prototype.hasOwnProperty.call(promoteList, key)) {
                console.log(`${key}:${promoteList[key]}`)
                
            }
        }
    } catch (err) {
        console.error(err);
    }
};
