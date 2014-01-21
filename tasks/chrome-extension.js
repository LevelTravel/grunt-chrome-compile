/**
 * Modified by Anton Sivolapov
 *
 * Original build:
 *
 * grunt-chrome-compile
 * https://github.com/scarrillo/grunt-chrome-compile
 *
 * Copyright (c) 2013 scarrillo
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
    //Windows? to build right pathes
    var isWin = !!process.platform.match(/^win/);

    var path = require('path');
    var exec = require('child_process').exec;

	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-compress');

	grunt.registerTask('chrome-extension', 'Package a google chrome extension', function() {
		grunt.config.requires('chrome-extension.options.name');
		grunt.config.requires('chrome-extension.options.chrome');
		grunt.config.requires('chrome-extension.options.certPath');
		grunt.config.requires('chrome-extension.options.crxPath');
		grunt.config.requires('chrome-extension.options.buildDir');
		grunt.config.requires('chrome-extension.options.zipPath');

		// Merge task-specific and/or target-specific options with these defaults.
		var options = this.options({
			resources: [
				"js/**",
				"images/**",
				"*.html"
			],
			extension: {
				path: '',
				cert: '',
				crx: '',
				zip: ''
			}
		});

        if( options.force ){
            grunt.option('force', true);
        }

        options.chrome = buildAbsolutePath(options.chrome);
		options.extension.path = options.buildDir;
		options.extension.cert = options.certPath;
		options.extension.crx = options.crxPath;
		options.extension.zip = options.zipPath;

		grunt.log.writeln('chrome-extension: ' + options.name);
		grunt.log.writeln('\tchrome: '+options.chrome);
		grunt.log.writeln('\tpath: '+options.extension.path);
		grunt.log.writeln('\tcert: '+options.extension.cert);
		grunt.log.writeln('\tcws zip: '+options.extension.zip);

		grunt.option('extensionOptions', options);
		grunt.task.run(
			'chrome-extension-copy',
			'chrome-extension-compress',
			'chrome-extension-compile',
            'chrome-extension-clean'
		);
	});

	grunt.registerTask('chrome-extension-copy', 'copy extension resources to a build folder', function(){
		var options = grunt.option('extensionOptions');

		if( grunt.file.exists(options.extension.path) ){
			grunt.file.delete(options.extension.path);
		}
		grunt.file.mkdir(options.extension.path);
		grunt.config.set('copy.extension', { files: [
			{expand: true, cwd: options.cwd || '.', src: options.resources, dest: options.extension.path}
		]});
		grunt.task.run('copy:extension');
	});

	grunt.registerTask('chrome-extension-compress', 'compress build folder into a zip for the chrome web store', function() {
		var options = grunt.option('extensionOptions');

		grunt.config.set('compress.extension', {
			options: { archive: options.extension.zip },
			files: [
				// dest == the folder name within the zip. explicit here, but equivilant to passing empty string 
				{expand: true, cwd: options.extension.path,  src: ['**/*'], dest: options.name }
			]
		});
		grunt.task.run('compress:extension');
	});

	grunt.registerTask('chrome-extension-compile', 'compile a crx using google chrome', function() {
		var options 	= grunt.option('extensionOptions');
		var done 		= this.async();
		var ext_path	= buildAbsolutePath(options.extension.path);
		var cert_path	= buildAbsolutePath(options.extension.cert);
		var basename 	= path.basename(ext_path);
		var command 	= [ '"' + options.chrome + '"', '--no-message-box' ];
		var pem_create	= false

		if(!grunt.file.exists( ext_path )){
			grunt.log.warn("Unable to fine extension in " + ext_path)
			return false
		}else{ command.push('--pack-extension='+ext_path); }

		if(grunt.file.exists( cert_path )){
			command.push('--pack-extension-key=' + cert_path);
		}else{ pem_create = true }

        command = command.join(' ')

        grunt.log.writeln( 'Executing command: %s', command );
        exec( command ,
            function (error, stdout, stderr) {
                if (error !== null) {
                    console.log('Error while compiling CRX, maybe not all necessary files was copied: ' + error);
                }else{
                    grunt.log.writeln( 'Moving CRX..' );
                    var filePath = options.extension.path + '.crx';
                    grunt.file.copy( filePath, options.extension.crx );
                    grunt.file.delete( filePath );
                    if(pem_create){
                    	grunt.log.writeln( 'Moving PEM..' );
                    	var filePath = options.extension.path + '.pem';
                    	grunt.file.copy( filePath, cert_path );
                    	grunt.file.delete(filePath);
                    }
                    done();
                }
            });
	});

    grunt.registerTask('chrome-extension-clean', 'clean the build folder', function() {
        grunt.log.writeln( 'Cleaning tmp dir..' );

        var options = grunt.option('extensionOptions');

        var cleanPath = options.extension.path;
        if(options.clean && grunt.file.exists(cleanPath)) {
            grunt.file.delete(cleanPath);
        }
    });

    /**
     * Build absolute path according to OS
     */
    function buildAbsolutePath(file){
        var absPath = path.resolve(file);
        if( isWin ){
            absPath = '\"' + absPath + '\"';
        }
        return absPath;
    }
};
