#!/usr/bin/env node
const RMLMapperWrapper = require('@rmlio/rmlmapper-java-wrapper');
const fs = require('fs');
const fsPath = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const rmlmapperPath = fsPath.resolve(process.env.RMLMAPPER);
const rmlmappingPath = fsPath.resolve(process.env.RMLMAP);
const tempFolderPath = fsPath.resolve(process.env.TEMPDIR);

const input = process.argv[2];

if (!input) {
    console.error(`usage: bin/generate_rdf.js file`);
    process.exit(1);
}

const what = fsPath.basename(input).replace(/\.\w+$/,'');

const rml = patchMapping(rmlmappingPath,what);
const data = pathCSL(input);

const wrapper = new RMLMapperWrapper(rmlmapperPath,tempFolderPath, true);
const sources = {
    [`${what}.json`]: data
};

main();

async function main() {
    const result = await wrapper.execute(rml, { sources, generateMetadata: false, serialization: 'turtle'});
    console.log(result.output);
}

function patchMapping(path,what) {
    const data = fs.readFileSync(path,'utf-8');
    const patched = data.replace(/%%FILE%%/g,`${what}.json`);
    return patched;
}

function pathCSL(path) {
    const data = JSON.parse(fs.readFileSync(path,'utf-8'));

    for (let i = 0 ; i < data.length ; i++) {
        // Set a URL when none is given
        if (! data[i]['URL']) {
            if (data[i]['DOI']) {
                data[i]['URL'] = `https://doi.org/${data[i]['DOI']}`;
            }
            else {
                console.error(`warning: no URL and no DOI!`);
            }
        }

        // Add unique identifiers to authors
        const author = data[i]['author'];
        if (author && Array.isArray(author)) {
            for (let j = 0 ; j < author.length ; j++) {
                author[j]['id'] = `urn:uuid:${uuidv4()}`;
            }
        }

         // Add unique identifiers to editors
         const editor = data[i]['editor'];
         if (editor && Array.isArray(editor)) {
             for (let j = 0 ; j < editor.length ; j++) {
                editor[j]['id'] = `urn:uuid:${uuidv4()}`;
             }
         }
    }

    return JSON.stringify(data,null,2);
}