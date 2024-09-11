
const postgres = require('postgres');
const logger = require('./util').getLogger();

const CACHE_TABLE = "cache";

function connect() {
    const database = process.env.POSTGRES_DATABASE;
    const username = process.env.POSTGRES_USER;
    const password = process.env.POSTGRES_PASSWORD;

    logger.info(`connecting to ${username}@${database}`);
    
    return postgres({ 
        database: database,
        username: username,
        password: password
    });
}

async function initCache() {
    const sql = connect();

    logger.debug(`dropping ${CACHE_TABLE}...`);

    await sql`DROP TABLE IF EXISTS ${sql(CACHE_TABLE)};`;

    await sql`
CREATE TABLE IF NOT EXISTS ${sql(CACHE_TABLE)} (
    id varchar(120) CONSTRAINT firstkey PRIMARY KEY,
    data JSON NOT NULL,
    context JSONB NOT NULL,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;
    sql.end();
    return true;
}

async function addCache(notification,context = {}) {
    if (! notification.id) {
        logger.error(`notification has no id?`);
        logger.error(notification);
        return null;
    }

    const sql = connect();

    const record = {
        id: notification.id ,
        data: notification,
        context: context
    };

    await sql`
        INSERT INTO ${sql(CACHE_TABLE)} ${
            sql(record, 'id', 'data', 'context')
        } ON CONFLICT (id) DO UPDATE SET data = ${record.data}, context = ${record.context}`;

    sql.end();

    return notification.id;
}

async function getCache(id) {
    const sql = connect();
    
    const result = await sql`
        SELECT data FROM ${sql(CACHE_TABLE)} WHERE id = ${id}
    `;

    let json;

    if (result.length > 0) {
        json = result[0].data;
    }

    sql.end();

    return json;
}

async function getCacheContext(id) {
    const sql = connect();
    
    const result = await sql`
        SELECT context, created FROM ${sql(CACHE_TABLE)} WHERE id = ${id}
    `;

    let json;

    if (result.length > 0) {
        json = result[0].context;
        json['updated'] = result[0].created;
    }

    sql.end();

    return json;
}

async function listCache(dataPath,contextPath) {
    const sql = connect();
    
    const dataFilter = makeQuery('data',dataPath);
    const contextFilter = makeQuery('context',contextPath);

    let query = `SELECT * FROM ${CACHE_TABLE}`;

    if (dataFilter || contextFilter) {
        const parts = [];

        if (dataFilter) {
            parts.push(dataFilter);
        }
        
        if (contextFilter) {
            parts.push(contextFilter);
        }

        query += ` WHERE ${parts.join(' AND ')}`;
    }

    query += ` ORDER BY created ASC`;

    logger.debug(`sql: ${query}`);

    const result = await sql.unsafe(query);

    const list = result.map( (entry) => { return entry.id });

    sql.end();

    return list;
}

async function removeCache(id) {
    const sql = connect();
 
    const result = await sql`
        DELETE FROM ${sql(CACHE_TABLE)} WHERE id = ${id} RETURNING *
    `;

    sql.end();

    return result.length === 1 ? true : false;
}

function makeQuery(index,str) {
    if (! str) 
        return null;

    const matches = str.match(/^(\w+(\.\w+)*)\s*(=|!=)\s*(.*)/);

    if (! matches) 
        return null;

    const path = matches[1]
                    .split(/\./)
                    .map( (x) => `'${x}'`)
                    .join("->")
                    .replace(/('\w+')$/,">$1");
    const operator = matches[3];
    const value = matches[4].replace(/'/,"\\\'");

    return `${index}::jsonb->${path} ${operator} '${value}'`;
}

module.exports = { 
    initCache ,
    addCache ,
    getCache ,
    getCacheContext ,
    listCache ,
    removeCache 
};