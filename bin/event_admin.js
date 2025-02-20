#!/usr/bin/env node

const { program } = require('commander');
const cache = require('../lib');
const fs = require('fs');
const { open } = require('node:fs/promises');
const chalk = require('chalk');

require('dotenv').config();

const CACHE_NAME = process.env.CACHE_NAME || "cache";

program
    .name('event_admin.js')
    .option(`--name <name>`,'Name of cache table', CACHE_NAME);

program 
    .command('env')
    .action( () => {
        console.log(program.opts());
    });

program
    .command('init')
    .option(`--drop`,'Drop the old data')
    .action( async(opts) => {
        const other = program.opts();
        other['drop'] = opts.drop;
        const result = await cache.initCache(other);
        console.log(result);
    });

program
    .command('list')
    .option('-qp,--query-path <path_query>','data query')
    .option('-cp,--context-path <path_query>','context query')
    .option('--limit <num>','maximum number of records to return')
    .option('--offset <num>','offset for the quert')
    .action( async (opts) => {
        const other = program.opts();
        other['limit'] = opts.limit;
        other['offset'] = opts.offset;
        const result = await cache.listCache(opts.queryPath,opts.contextPath,other);

        if (result) {
            for (let i = 0 ; i < result.length ; i++) {
                console.log(result[i]);
            }
        }
    });

program
    .command('get')
    .option('-c,--context')
    .argument('<id>','cache identifier')
    .action( async (id,opts) => {
        if (opts.context) {
            const result = await cache.getCacheContext(id,program.opts());
            console.log(JSON.stringify(result,null,2));
        }
        else {
            const result = await cache.getCache(id,program.opts());
            console.log(JSON.stringify(result,null,2));
        }
    });

program
    .command('export')
    .option('-qp,--query-path <path_query>','data query')
    .option('-cp,--context-path <path_query>','context query')
    .option('--intention <intention>','mirror|rdf','mirror')
    .action( async (opts) => {
        const result = await cache.listCache(opts.queryPath,opts.contextPath, program.opts());

        for (let i = 0 ; i < result.length ; i++) {
            const id = result[i];
            const data = await cache.getCache(id,program.opts());

            if (opts.intention === 'mirror') {
                const context = await cache.getCacheContext(id,program.opts());

                console.log(JSON.stringify({
                    'data': data ,
                    'context': context
                }));
            }
            else if (opts.intention === 'rdf') {
                console.log(JSON.stringify(data));
            }
            else {
                console.error(`unknown intention ${opts.intention}`);
                console.error(`need mirror|rdf`);
                process.exit(2);
            }
        } 
    });

program
    .command('import')
    .argument('<file>','export file')
    .action( async (file) => {
        const fh = await open(file);
        for await (const line of fh.readLines()) {
            const json = JSON.parse(line);
            const data = json.data;
            let context = json.context;

            if (data.original) {
                // Hack to inject an original in the data for test purposes...
                context['original'] = data.original;
            }
        
            const result = await cache.addCache(data,context,program.opts());
            console.log(result);
        }
    });

program
    .command('add')
    .argument('<file...>','json notification')
    .action( async (file) => {
        for (let i = 0 ; i < file.length ; i++) {
            const json = file[i];
            const data = JSON.parse(fs.readFileSync(json, { encoding: 'utf-8'}));
            let context = {};
            if (data.original) {
                // Hack to inject an original in the data for test purposes...
                context['original'] = data.original;
            }
            else if (fs.existsSync(`${json}.meta`)) {
                context = JSON.parse(fs.readFileSync(`${json}.meta`, { encoding: 'utf8'}));
            }
            const result = await cache.addCache(data,context,program.opts());
            console.log(result);
        }
    });

program
    .command('remove')
    .argument('<id>','cache identifier')
    .action( async (id) => {
        const result = await cache.removeCache(id,program.opts())
        console.log(result);
    });

program
    .command('remove-all')
    .action( async () => {
        const list = await cache.listCache(null,null,program.opts());
        for (let i = 0 ; i < list.length ; i++) {
            const result = await cache.removeCache(list[i],program.opts());
            console.log(`${list[i]} ${result}`);
        }
    });

program
    .command('summary')
    .option('-n,--names','Show names instead of actor id')
    .argument('[id]', 'for this identifier')
    .action( async (id,opts) => {
        if (id) {
            await summaryFor(id,0,opts);
        
            const list = await cache.listCache('',`original=${id}`,program.opts());
            for (let i = 0 ; i < list.length ; i++) {
                await summaryFor(list[i],2,opts);
            }
        }
        else {
            const list = await cache.listCache('','original=NULL',program.opts());

            for (let i = 0 ; i < list.length ; i++) {
                await summaryFor(list[i],0,opts);
            }
        }
    });

program.parse();

async function summaryFor(thisId,spacing = 0,opts) {

    const notification = await cache.getCache(thisId,program.opts());
    const context = await cache.getCacheContext(thisId,program.opts());

    if (! (notification && context)) {
        return;
    }
   
    if (! (notification.actor && notification.object)) {
        return;
    }

    const id = notification.id;
    const type = notification.type;
    let actor = notification.actor.id;

    if (opts.names && notification.actor.name) {
        actor = notification.actor.name;
    }

    let target = notification.target?.id; 

    if (opts.names && notification.target?.name) {
        target = notification.target.name;
    }

    const object = notification.object.id;
    const url = notification.object.url;
    const updated = (new Date(context.updated)).toISOString();

    let sp = ' '.repeat(spacing); 
    
    console.log(`${sp}${chalk.blue(id)} ${chalk.red(type)}`);

    if (context.original) {
        console.log(`${sp} ${chalk.yellow('original')}: ${chalk.blue(context.original)}`);
    }
    
    console.log(`${sp} ${chalk.yellow('updated')}: ${updated}`);
    console.log(`${sp} ${chalk.yellow('from')}: ${actor}`);
    console.log(`${sp} ${chalk.yellow('to')}: ${target}`);
    console.log(`${sp} ${chalk.yellow('object')}: ${object}`);
    
    if (! context.original && url) {
        if (Array.isArray(url)) {
            for (let i = 0 ; i < url.length ; i++) {
                console.log(`${sp} ${chalk.yellow('url')}: ${url[i].href}`);
            }
        }
        else {
            console.log(`${sp} ${chalk.yellow('url')}: ${url.href}`);
        }
    }
    
    if (notification.type === 'Announce' &&
        notification.object?.type === 'Note' &&
        notification.object?.content) {
        const content = notification.object.content.replace(/<[^>]+>/g,'');
        console.log(`${sp} - ${chalk.yellow('content')}: ${content}`);
    }

    console.log();
}
