const semver = require('semver');
const { Table  } = require('console-table-printer');
const spawn = require('child_process').spawn;
const kubectl = spawn('kubectl', ['get', 'pods', '--all-namespaces', '-o=json']);
const myArgs = process.argv.slice(2);

const analyse = (namespaceNames = []) => {
const namespaces = [];
namespaceNames.forEach( name => {
    namespaces.push({
        name: name,
        pods: []
    });
});
let datas = ""; 
kubectl.stdout.on('data', (data) => {
    datas += data;
  });
  
  kubectl.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });
  
  kubectl.on('close', (code) => {
    const json = JSON.parse(datas);
    datas = "";
    json.items.forEach(item => {
        const namespaceSelected = namespaces.find(namespace => {
            return namespace.name === item.metadata.namespace
        });
        if( namespaceSelected !== undefined) {
            namespaceSelected.pods.push({
                name: item.metadata.labels.app,
                version: item.spec.containers[0].image.replace(/^[^:]+:/,'').trim(),
                image: item.spec.containers[0].image,
                semverColor: 'green',
                semverDiff: ''
            });
        }
    });

    for(let i = 1; i < namespaces.length; i++) {
        namespaces[i].pods.forEach(pod => {
            const selectedPod = namespaces[0].pods.find(item => {
                return pod.name === item.name
            });
            if( selectedPod !== undefined) {
                if( semver.valid(pod.version)&& semver.valid(selectedPod.version)) {
                    if (semver.lt(pod.version,selectedPod.version)) {
                        const semverDiff = semver.diff(pod.version,selectedPod.version);
                        if (semverDiff === 'major' || semverDiff === 'minor') {
                            pod.semverColor = 'red';
                            pod.semverDiff = `${selectedPod.version} ${semverDiff} version needed`;
                        }
                        if (semverDiff === 'patch') {
                            pod.semverColor = 'yellow';
                            pod.semverDiff = `${selectedPod.version} ${semverDiff} version needed`;
                        }
                    } else {
                        pod.semverDiff = 'Ok';
                    }
                }
            } else {
                pod.semverDiff = `Pod not found in ${namespaces[0].name}`;
            }
        });
    }
    namespaces[0].pods.forEach(pod => {
        const ns = [];
        for(let i = 1; i < namespaces.length; i++) {
            const selectedPod = namespaces[i].pods.find(item => {
                return pod.name === item.name
            });
            if( selectedPod === undefined) {
                ns.push(namespaces[i].name);
            }
        }
        if (ns.length > 0) {
            pod.semverDiff = `Pod not found in namespace(s): ${ns.join(', ')}`;
            pod.semverColor = 'red';
        }

    });

    const tableData =  new Table({
        columns: [
          { name: 'Namespace', alignment: 'left'}, //with alignment and color
          { name: 'Pod name', alignment: 'left' },
          { name: 'Pod version', alignment: 'right' },
          { name: 'Analysis', alignment: 'left' }
        ],
      });
    // console.log(`Namespace\t\t\tPod name\t\t\t$Pod version`)
    namespaces.forEach(ns => {
        ns.pods.forEach(pod => {
            tableData.addRow({
                'Namespace': ns.name,
                'Pod name': pod.name,
                'Pod version': pod.version,
                'Analysis': pod.semverDiff
            }, { color: pod.semverColor });
        });
    });
    tableData.printTable();
  });

};

exports.analyse = analyse;