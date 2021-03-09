
const spawn = require('child_process').spawn;

export {Kubernates}

class Kubernates {
    infos: any;

     async init() {
        return new Promise( async (resolve, reject) => {
            let datas: string = '';
            const kubectl = spawn('kubectl', ['get', 'pods', '--all-namespaces', '-o=json']);
            kubectl.stdout.on('data', (data: string) => {
                datas += data;
              });
              
              kubectl.stderr.on('data', (data: string) => {
                return reject(data);
              });
              
              kubectl.on('close', () => {
                  this.infos = JSON.parse(datas);

                  return resolve();
             });
        });
     }

     getCurrentRelease(_namespace: string, _repo: string): string|undefined {
        const item = this.infos.items.find((item: any) => {
            let repo = item.spec.containers[0].image.split('/').slice(-1)[0];
            repo = repo.split(':')[0];
            return _namespace === item.metadata.namespace && _repo === repo;
        });
        if (item) {
            return item.spec.containers[0].image.replace(/^[^:]+:/,'').trim();
        } else {
            return undefined;
        }
        
    }
}
