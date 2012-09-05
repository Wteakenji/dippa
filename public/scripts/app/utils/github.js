define(function() {

    console.log('app/utils/github.js')

    var Github = Object.freeze({

        /**
         * Parses given Github URL and returns repository name and owner.
         *
         * The URL can be in these three formats:
         *
         *   www:               https://github.com/rap1ds-testing/dippa
         *   git over https:    https://rap1ds-testing@github.com/rap1ds-testing/dippa.git
         *   https              https://(rap1ds-testing@)github.com/rap1ds-testing/dippa(.git)
         *   git over ssh:      git@github.com:rap1ds-testing/dippa.git
         *   git read-only:     git://github.com/rap1ds-testing/dippa.git
         *
         * @param url
         *
         * @return {owner, name} or undefined if illegal URL
         */
        parseRepositoryUrl: function(url) {

            // Github username:
            // Username may only contain alphanumeric characters or dashes and cannot begin with a dash
            var usernameRegExp = "[A-Za-z0-9][A-Za-z0-9-]*";

            // Github reponame:
            // . - _ are ok
            var repoNameRegExp = "[A-Za-z0-9-._]+";

            var httpsRegExp = new RegExp("https:\/\/(?:" + usernameRegExp + "@)?github.com\/(" + usernameRegExp + ")\/(" + repoNameRegExp + ")\.git$", "i");
            var wwwRegExp = new RegExp("https?:\/\/github.com\/(" + usernameRegExp + ")\/(" + repoNameRegExp + ")(?:\/.*)?$", "i");
            var gitRegExp = new RegExp("git@github\.com:(" + usernameRegExp + ")\/(" + repoNameRegExp + ").git$", "i");
            var gitReadOnlyRegExp = new RegExp("git:\/\/github.com\/(" + usernameRegExp + ")\/(" + repoNameRegExp + ").git$", "i");

            var result;
            if(httpsRegExp.test(url)) {
                result = httpsRegExp.exec(url);
            } else if(wwwRegExp.test(url)) {
                result = wwwRegExp.exec(url);
            } else if(gitRegExp.test(url)) {
                result = gitRegExp.exec(url);
            } else if(gitReadOnlyRegExp.test(url)) {
                result = gitReadOnlyRegExp.exec(url);
            }

            if(result && result.length === 3) {
                return {owner: result[1], name: result[2]};
            } else {
                return undefined;
            }
        }
    });

    return Github;

});