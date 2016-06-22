'use strict';

var jsonFile = require('jsonFile');
var _ = require('underscore');
var commondir = require('commondir');
var fs = require('fs');

var generateReport = function(options) {
    
    var featureOutput = jsonFile.readFileSync(options.jsonFile);
    var packageJson = jsonFile.readFileSync('package.json', 'utf8');

    var suite = {
        name: packageJson.name,
        version: packageJson.version,
        time: new Date(),
        features: {
            featureOutput: featureOutput,
            isFailed: false,
            passed: 0,
            failed: 0
        },
        passed: 0,
        failed: 0,
        scenarios: {
            passed: 0,
            failed: 0,
            skipped: 0,
            notdefined: 0
        }
    };

    var setStats = function(suite) {
        var featureOutput = suite.features.featureOutput;
        var features = suite.features;
        var rootDir = commondir(_.pluck(featureOutput, 'uri'));
        var screenShotDirectory;

        if (options.output.lastIndexOf('/') > -1) {
            screenShotDirectory = options.output.substring(0, options.output.lastIndexOf('/')) + '/screenshot/';
        } else {
            screenShotDirectory = 'screenshot/';
        }

        featureOutput.forEach(function(feature) {
            feature.relativeFolder = feature.uri.slice(rootDir.length);
            feature.scenarios = {};
            feature.scenarios.passed = 0;
            feature.scenarios.failed = 0;
            feature.scenarios.notdefined = 0;
            feature.scenarios.skipped = 0;
            features.isFailed = false;

            if (!feature.elements) {
                return;
            }

            feature.elements.forEach(function(element) {
                element.passed = 0;
                element.failed = 0;
                element.notdefined = 0;
                element.skipped = 0;

                element.steps.forEach(function(step) {
                    if (step.embeddings !== undefined) {
                        var Base64 = require('js-base64').Base64;
                        step.embeddings.forEach(function(embedding) {
                            if (embedding.mime_type === "text/plain") {
                                if (!step.text) {
                                    step.text = Base64.decode(embedding.data);
                                } else {
                                    step.text = step.text.concat('<br>' + Base64.decode(embedding.data));
                                }
                            } else {
                                var name = step.name && step.name.split(' ').join('_') || step.keyword.trim();
                                if (!fs.existsSync(screenShotDirectory)) {
                                    fs.mkdirSync(screenShotDirectory);
                                }
                                name = name + Math.round(Math.random() * 10000) + '.png'; //randomize the file name
                                var filename = screenShotDirectory + name;
                                fs.writeFile(filename, new Buffer(embedding.data, 'base64'), function(err) {
                                    if (err) {
                                        console.error('Error saving screenshot ' + filename); //asynchronously save screenshot
                                    }
                                });
                                step.image = 'screenshot/' + name;
                            }
                        });
                    }

                    if (!step.result) {
                        return 0;
                    }
                    if (step.result.status === 'passed') {
                        return element.passed++;
                    }
                    if (step.result.status === 'failed') {
                        return element.failed++;
                    }
                    if (step.result.status === 'undefined') {
                        return element.notdefined++;
                    }

                    element.skipped++;
                });

                if (element.notdefined > 0) {
                    feature.scenarios.notdefined++;
                    return suite.scenarios.notdefined++;
                }

                if (element.failed > 0) {
                    feature.scenarios.failed++;
                    features.isFailed = true;
                    return suite.scenarios.failed++;
                }

                if (element.skipped > 0) {
                    feature.scenarios.skipped++;
                    return suite.scenarios.skipped++;
                }

                if (element.passed > 0) {
                    feature.scenarios.passed++;
                    return suite.scenarios.passed++;
                }
            });

            if (features.isFailed) {
                features.failed++;
                suite.failed++;
            } else {
                features.passed++;
                suite.passed++;
            }

            if (options.reportSuiteAsScenarios) {
                suite.failed = suite.scenarios.failed;
                suite.passed = suite.scenarios.passed;
            }

            return suite;

        });

        suite.features = features;

        return suite;
    };

    function readFile(fileName) {
        function getPath(name) {
            if(options.templateDir) {
                return options.templateDir + '/' + name;
            } else {
                return 'node_modules/grunt-cucumberjs/templates/' + options.theme + '/' + name;
            }
        }

        return fs.readFileSync(getPath(fileName), 'utf-8');
    }

    suite = setStats(suite);
    fs.writeFileSync(
        options.output,
        _.template(readFile('index.tmpl'))({
            suite: suite,
            version: packageJson.version,
            time: new Date(),
            features: _.template(readFile('features.tmpl'))({
                suite: suite,
                _: _
            }),
            styles: readFile('style.css'),
            script: readFile('script.js'),
            piechart: (options.theme === 'bootstrap') ? readFile('piechart.js') : undefined
        })
    );

    console.log('Generated ' + options.output + ' successfully.');
};

function generate(options) {
    
    function isValidJsonFile() {
        options.jsonFile = options.jsonFile || options.output + '.json';
        
        try {
            JSON.parse(JSON.stringify(jsonFile.readFileSync(options.jsonFile)));
            return true;
        } catch (e) {
            console.error('Unable to parse cucumberjs output into json: \'%s\'', options.jsonFile, e);
            if(options.callback) {
                options.callback(false);
            } else {
                return false;
            }
        }
    }

    if (!options.theme) {
        options.theme = 'bootstrap';
    }
    
    if(isValidJsonFile()) {
        return generateReport(options)
    }
}

module.exports = {
    generate: generate
};
