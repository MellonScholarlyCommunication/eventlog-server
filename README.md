# Event Log Server

A small event log server for demonstration purposes

# Install

```
yarn install
```

# Run

```
yarn server
```

# Demo

Show the trace of the latest Event Log

```
http://localhost:8000/trace?artifact=latest
```

Show the trace of an Event log about `http://abc.org`:

```
http://localhost:8000/trace?artifact=http://abc.org
```

## Development mode (docker)

Start the postgres server:

```
yarn db-start
```

Stop the postgres server:

```
yarn db-stop
```

Run a psql shell:

```
yarn db-shell
```
