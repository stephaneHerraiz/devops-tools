//const { Octokit } = require('@octokit/rest');
const { graphql } = require('@octokit/graphql');
const { createAppAuth } = require('@octokit/auth-app');
const { request }  = require('@octokit/request');
import semver from "semver";
const fs = require('fs');

export { Github, repository };

interface repository {
    owner: string,
    name: string,
    release: string,
    url: string
}

class Github {
    requestWithAuth: any;
    graphqlWithAuth: any;
    constructor() {
        
    }

   init() {
        return new Promise( async (resolve) => {
            const privateKey: any = await fs.promises.readFile('./src/lib/github/byd-devops-cli.2020-09-29.private-key.pem')
            const auth = createAppAuth({
                id: 82788,
                privateKey: privateKey,
                installationId: 12111934
            });
        
            this.requestWithAuth = request.defaults({
                request: {
                hook: auth.hook
                }
            });

            this.graphqlWithAuth = graphql.defaults({
            request: {
                hook: auth.hook
                }
            });
            return resolve();
        });
    }

    public async getJiraIssueByRelease(_repo: string, _release: string, _JiraProjectPrefix: string): Promise<string[]> {
        return new Promise( async (resolve, reject) => {
            try {
                const { repository } = await this.graphqlWithAuth(`
                {
                    repository(owner: "sxd-platform", name: "${_repo}" ) {
                        release( tagName: "${_release}" ) {
                            
                            name,
                            description
                            
                        }
                    }
                }
                `);
                const issues :Array<string> = [];
                const it = repository.release.description.matchAll(`${_JiraProjectPrefix}-[0-9]+`);
                for (const key of it) {
                    if(issues.indexOf(key[0])) {
                        issues.push(key[0]);
                    }
                }
                resolve(issues);

            } catch (err) {
                reject(err);
            };
        });
    }

    public async getReleaseByJiraIssue(_issue: string, _topic: string): Promise<Array<repository>> {
        return new Promise( async (resolve, reject) => {
            try {
                const { search } = await this.graphqlWithAuth(`
                query {
                    search(
                      type:REPOSITORY, 
                      query: """ user:sxd-platform topic:${_topic} """,
                      last: 100
                    ) {
                        repositories: edges {
                            repository: node {
                                ... on Repository {
                                    name,
                                    url,
                                    releases( last:100 ) {
                                        list: edges {
                                            release: node {
                                                name,
                                                description
                                            }
                                        }
                                        
                                    }
                                }
                            }
                        }
                    }
                }
                `);
                search.repositories.forEach((repo: any) => {
                    repo.repository.releaseToApply = [];
                    repo.repository.releases.list.forEach((release: any) => {
                        if (release.release.description) {  
                            if (release.release.description.includes(_issue)) {
                                repo.repository.releaseToApply.push(release.release.name);
                            }
                        }
                    });
                });
                search.repositories = search.repositories.filter((repo: any) => {
                    return repo.repository.releaseToApply.length > 0;
                });
                const repositories:Array<repository> = [];
                search.repositories.forEach((repo: any) => {
                    // Get only last version of the release
                    let gtrelease = '0.0.0';
                    repo.repository.releaseToApply.forEach((release: string) => {
                        release = release.replace(/[^0-9.]/g, '');
                        if(semver.valid(release)) {
                            if ( semver.gt(release, gtrelease)) {
                                gtrelease = release;
                            }
                        }
                    });
                    repositories.push({
                        url : repo.repository.url,
                        owner: 'sxd-platform',
                        name: repo.repository.name,
                        release: gtrelease
                    });
                });

                resolve(repositories);
            } catch (err) {
                reject(err);
            };
        });
    }

    // async _getJiraIssueByVersions(repo: string, release: string) {
    //     try {
    //     const result = await this.requestWithAuth("GET /repos/:owner/:repo/releases/:release ", {
    //         owner: 'sxd-platform',
    //         repo: repo,
    //         release: release
    //     });
    //     result.data.forEach((release: any) => {

    //         let tasks = [...release.body.matchAll(`${this.projectPrefix}-[0-9]+`)];
    //         console.log(`${release.name}: ${tasks.join(', ')}`);
    //     });
    //     } catch (err) {
    //         console.error(err);
    //     };
    // }

}