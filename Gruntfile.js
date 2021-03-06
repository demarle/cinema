module.exports = function (grunt) {
    var staticRoot;
    var fs = require('fs');
    var jade = require('jade');
    var path = require('path');

    // Pass a "--env=<value>" argument to grunt. Default value is "dev".
    var environment = grunt.option('env') || 'dev';
    if (['dev', 'prod'].indexOf(environment) === -1) {
        grunt.fatal('The --env argument must be either "dev" or "prod".');
    }

    // Pass a "--port=<value>" argument to grunt to change the server port.
    var port = Number(grunt.option('port') || '8081');

    // Project configuration.
    grunt.config.init({
        pkg: grunt.file.readJSON('package.json'),

        copy: {
            ext: {
                expand: true,
                flatten: true,
                src: ['node_modules/bootstrap/dist/css/bootstrap.min.css',
                      'node_modules/rickshaw/rickshaw.min.css' ],
                dest: 'web/dist/built/'
            },
            shaders: {
                cwd: 'web/src/shaders',
                src: '**/*',           // copy all files and subfolders
                dest: 'web/dist/shaders',    // destination folder
                expand: true
            }
        },

        extend: {
            options: {
                defaults: {
                    staticRoot: '',
                    dataRoot: '/data',
                    title: 'ParaView Cinema'
                }
            },
            config: {
                files: {
                    'config.json': ['config.json']
                }
            }
        },

        jade: {
            options: {
                client: true,
                compileDebug: false,
                processName: function (filename) {
                    return path.basename(filename, '.jade');
                }
            },
            app: {
                files: {
                    'web/dist/built/cinema.app.templates.js': [
                        'web/src/templates/app/**/*.jade'
                    ]
                },
                options: {
                    namespace: 'cinema.app.templates'
                }
            },
            lib: {
                files: {
                    'web/dist/built/cinema.templates.js': [
                        'web/src/templates/lib/**/*.jade'
                    ]
                },
                options: {
                    namespace: 'cinema.templates'
                }
            }
        },

        stylus: {
            app: {
                files: {
                    'web/dist/built/cinema.app.min.css': [
                        'web/src/stylesheets/app/**/*.styl'
                    ]
                }
            },
            lib: {
                files: {
                    'web/dist/built/cinema.min.css': [
                        'web/src/stylesheets/lib/**/*.styl'
                    ]
                }
            }
        },

        uglify: {
            options: {
                sourceMap: environment === 'dev',
                sourceMapIncludeSources: true,
                report: 'min',
                beautify: {
                    ascii_only: true
                },
                mangle: environment !== 'dev'
            },
            app: {
                files: {
                    'web/dist/built/cinema.app.min.js': [
                        'web/dist/built/cinema.app.templates.js',
                        'web/src/js/app/**/*.js',
                        'web/src/js/app-main.js'
                    ]
                }
            },
            ext: {
                files: {
                    'web/dist/built/cinema.ext.min.js': [
                        'web/ext/shim.js',
                        'node_modules/jquery-browser/lib/jquery.js',
                        'node_modules/jade/runtime.js',
                        'node_modules/underscore/underscore.js',
                        'node_modules/backbone/backbone.js',
                        'node_modules/bootstrap/dist/js/bootstrap.js',
                        'node_modules/d3/d3.js',
                        'node_modules/jsep/build/jsep.js',
                        'node_modules/rickshaw/rickshaw.js',
                        'node_modules/gl-matrix/dist/gl-matrix.js',
                        'web/ext/vector.js',
                        'node_modules/scrollpoints/scrollpoints.js',
                        'web/ext/jquery-visible.js'
                    ]
                }
            },
            lib: {
                files: {
                    'web/dist/built/cinema.min.js': [
                        'web/src/js/init.js',
                        'web/dist/built/cinema.templates.js',
                        'web/src/js/lib/**/*.js'
                    ]
                }
            },
        },

        watch: {
            stylus_app: {
                files: ['web/src/stylesheets/app/**/*.styl'],
                tasks: ['stylus:app']
            },
            stylus_lib: {
                files: ['web/src/stylesheets/lib/**/*.styl'],
                tasks: ['stylus:lib']
            },
            js_app: {
                files: ['web/src/js/app/**/*.js', 'web/src/js/app-main.js'],
                tasks: ['uglify:app']
            },
            js_lib: {
                files: ['web/src/js/lib/**/*.js', 'web/src/js/init.js'],
                tasks: ['uglify:lib']
            },
            jade_app: {
                files: ['web/src/templates/app/**/*.jade'],
                tasks: ['jade:app', 'uglify:app']
            },
            jade_lib: {
                files: ['web/src/templates/lib/**/*.jade'],
                tasks: ['jade:lib', 'uglify:lib']
            },
            index_html: {
                files: ['web/src/templates/index.html.jade'],
                tasks: ['index-html']
            },
            shaders: {
                files: ['web/src/shaders/**/*'],
                tasks: ['copy:shaders']
            }
        },

        express: {
            server: {
                options: {
                    port: port,
                    bases: ['web/dist', 'web']
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-jade');
    grunt.loadNpmTasks('grunt-contrib-stylus');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-express');
    grunt.loadNpmTasks('grunt-extend');

    grunt.registerTask('index-html', 'Build the index.html page.', function () {
        var buffer = fs.readFileSync('web/src/index.html.jade');
        var config = grunt.file.readJSON('config.json');

        var fn = jade.compile(buffer, {
            client: false,
            pretty: true
        });
        fs.writeFileSync('web/dist/index.html', fn({
            cssFiles: [
                'built/bootstrap.min.css',
                'built/rickshaw.min.css',
                'built/cinema.min.css',
                'built/cinema.app.min.css'
            ],
            jsFiles: [
                'built/cinema.ext.min.js',
                'built/cinema.min.js',
                'built/cinema.app.min.js'
            ],
            config: config
        }));
    });

    grunt.registerTask(
        'serve',
        'Serve the content at http://localhost:8081, ' +
        'use the --port option to override the default port',
        ['express', 'watch']
    );
    grunt.registerTask('build-js', ['jade', 'uglify:app', 'uglify:lib']);
    grunt.registerTask('init', ['copy:ext', 'copy:shaders', 'extend', 'uglify:ext', 'index-html']);
    grunt.registerTask('default', ['stylus', 'build-js']);
};
