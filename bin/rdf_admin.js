#!/usr/bin/env node
const { program } = require('commander');

const fetch = require('node-fetch');
const { generateQuads, serializeQuads, mainSubjects } = require('../lib/rdf');
const fs = require('fs');
const fsPath = require('path');

require('dotenv').config();

program
    .name('rdf_admin.js')
    .option(`--jar <jar>`,'RML Mapper jar to use', process.env.RMLMAPPER)
    .option(`--map <map>`,'RML Map to use', process.env.RMLMAP)
    .option(`--tmp <dir>`,'Temporary folder', process.env.TEMPDIR);

program
    .command('csl2rdf')
    .argument('<file>','CSL citation file or URL')
    .action( async(file) => {
        const opts = program.opts();
        const rmlmapperPath = fsPath.resolve(opts.jar);
        const rmlmappingPath = fsPath.resolve(opts.map);
        const tempFolderPath = fsPath.resolve(opts.tmp);

        let data;

        if (file.match(/^http/)) {
            data = await resolve(file);
        }
        else {
            data = JSON.parse(fs.readFileSync(file,'utf-8'));
        }

        const map = fs.readFileSync(rmlmappingPath,'utf-8');
        
        const param = {
            rmlMapper : rmlmapperPath ,
            rmlMap : map,
            tmp : tempFolderPath
        };

        const quads = await generateQuads(data, param);

        console.log(await serializeQuads(quads, { format: 'application/trig' }));
    });

program
    .command('event2rdf')
    .argument('<file>','Event file | URL')
    .action( async(file) => {
        const opts = program.opts();
        const rmlmapperPath = fsPath.resolve(opts.jar);
        const rmlmappingPath = fsPath.resolve(opts.map);
        const tempFolderPath = fsPath.resolve(opts.tmp);

        let data;

        if (file.match(/^http/)) {
            data = await resolve(file);
        }
        else {
            data = JSON.parse(fs.readFileSync(file,'utf-8'));
        }

        const referred_csl = await resolve(data.object.id);

        const map = fs.readFileSync(rmlmappingPath,'utf-8');
        
        const param = {
            rmlMapper : rmlmapperPath ,
            rmlMap : map,
            tmp : tempFolderPath
        };

        const quads = await generateQuads(referred_csl, param);

        console.log(await serializeQuads(quads, { format: 'application/trig' }));
    });

program.parse();

async function resolve(url) {
    const res = await fetch(url);

    if (res.ok) {
        return await res.json();
    }
    else {cur
        console.error(`failed to fetch ${url} : ${res.statusText}`);
    }
}
