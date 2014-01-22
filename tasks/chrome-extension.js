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
			'chrome-extension-manifest',
			'chrome-extension-update-xml',
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

	grunt.registerTask('chrome-extension-manifest', 'Builds a manifest.json from object passed to the options', function(){
		var options 	= grunt.option('extensionOptions'),
			manifest 	= options.manifest;

		if(manifest != null && Object.prototype.toString.call(manifest) == '[object Object]'){
			grunt.log.writeln("Creating manifest.json");
			if(manifest.update_url == null && options.updateUrl != null){
				manifest.update_url = options.updateUrl;
			}
			manifest = JSON.stringify(manifest);
			grunt.file.write(options.buildDir + '/manifest.json', manifest, { encoding: 'utf-8' });
		}else{
			grunt.log.writeln("Manifest is undefined. Define your own manifest.json");
		}
	});

	grunt.registerTask('chrome-extension-update-xml', 'Builds an update.xml file for automatic updates', function(){
		var options 	= grunt.option('extensionOptions'),
			update_info	= options.update,
			ext_name 	= path.basename(options.extension.crx);

		if(update_info != null && Object.prototype.toString.call(update_info) == '[object Object]'){
			grunt.log.writeln("Creating update.xml");
			var update_url	= update_info.url;
			if(!update_url.match(/\.crx$/i) || update_url.match(/\/$/)){
				var protocol 	= update_url.match(/http[s]?:\/\//gi)[0]
					update_url 	= update_url.replace(protocol, '');
					update_url	= protocol + (update_url + '/' + ext_name).replace(/([\/]+)/gi, '/')
			}
			var update_xml 	= '<?xml version="1.0" encoding="UTF-8"?>\n';
				update_xml += '<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">\n';
	  			update_xml += '  <app appid="' + update_info.id + '">\n';
	    		update_xml += '    <updatecheck codebase="'  + update_url +  '" version="' + update_info.version + '" />\n';
				update_xml += '  </app>\n';
				update_xml += '</gupdate>';

			grunt.file.write(options.buildDir + '/update.xml', update_xml, { encoding: 'utf-8' });
		}else{
			grunt.log.writeln("Update.xml is undefined. Define your own update.xml");
		}
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
			grunt.log.warn("Unable to find extension in " + ext_path)
			return false
		}else{ command.push('--pack-extension=' + ext_path); }

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
                    	grunt.file.copy( filePath, options.extension.cert );
                    	grunt.file.delete(filePath);
                    }
                    done();
                }
            });
	});

    grunt.registerTask('chrome-extension-clean', 'clean the build folder', function() {
        var options 	= grunt.option('extensionOptions'),
        	cleanPath 	= options.extension.path;
        
        grunt.log.writeln( 'Cleaning tmp dir [' + cleanPath + ']..' );
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
