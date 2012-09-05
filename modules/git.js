/**

 # git.js

 Git module handles the Command-Line integration to `git`

*/

var commandLine = require('../modules/commandline');
var Command = commandLine.Command;

function add(file, workingDir) {
    return new Command('git add ' + file, workingDir);
}

function commit(message, workingDir) {
    return new Command('git commit --all --message="' + message + '"', workingDir);
}

function push(workingDir) {
    return new Command('git push -u origin master', workingDir);
}

function pull(workingDir) {
    return new Command('git pull --rebase', workingDir);
}

function clone(user, repository, workingDir) {
    return new Command('git clone ssh://dippa.github.com/' + user + '/' + repository + '.git .', workingDir);
}

function initialPush(workingDir) {
    // TODO Consider running the commands
    return [
        add('dippa.tex', workingDir),
        add('ref.bib', workingDir),
        commit('Initialize', workingDir),
        push(workingDir)
    ];
}

function pushChanges(workingDir) {
    return commandLine.runAll([
        add('dippa.tex', workingDir),
        add('ref.bib', workingDir),
        commit('Update', workingDir),
        pull(workingDir),
        push(workingDir)
    ]);
}

module.exports = Object.freeze({
    add: add,
    commit: commit,
    push: push,
    pull: pull,
    clone: clone,
    pushChanges: pushChanges,
    initialPush: initialPush
});