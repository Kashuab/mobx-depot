#!/usr/bin/env node
import yargs from 'yargs';
import {hideBin} from "yargs/helpers";
import {generate} from "./generate";

yargs(hideBin(process.argv))
  .command('generate <url>', 'Generate models based on an introspection of the provided URL', build => build.string('url').string('outDir'), (argv) => {
    const { url, outDir = 'src/models' } = argv;
    if (!url) throw new Error('URL must be provided');

    console.log('Making introspection query to', url);
    console.log('Writing models to', outDir)

    if (typeof outDir !== 'string') {
      console.error('--outDir must be a string');
      process.exit(1);
    }

    generate({
      url,
      outDir
    });
  })
  .demandCommand(1)
  .parse()