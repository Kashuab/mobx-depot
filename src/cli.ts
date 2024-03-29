#!/usr/bin/env node
import yargs from 'yargs';
import {hideBin} from "yargs/helpers";
import {generate} from "./generate";

const argv = hideBin(process.argv).filter(s => s !== '--');

yargs(argv)
  .command(
    'generate <url>',
    'Generate models based on an introspection of the provided schema',
    build => (
      build
        .string('url').describe('url', 'Schema source. Can be a URL to introspect, a path to a schema.graphql file, or an already compiled introspection.json')
        .string('outDir').describe('outDir', 'Directory of which to write output to (defaults to "src/models")')
        .string('depotDirName').describe('depotDirName', 'Directory that untouchable auto-generated code should be placed in (defaults to "depot")')
        .string('include').describe('include', 'Gatekeep which object types get generated into models (Comma-separated values)')
        .string('exclude').describe('exclude', 'Exclude certain object types from being generated into models (Comma-separated values)')
        .boolean('react').describe('react', 'Include React utilities in generated output (defaults to "true")')
        .string('idFieldName').describe('idFieldName', 'Name of the field used to identify object types (defaults to "id")')
    ),
    (argv) => {
      const { url, outDir = 'src/models', include, exclude, react = true, idFieldName = 'id', depotDirName = "depot" } = argv;
      if (!url) throw new Error('URL must be provided');

      console.log('Making introspection query to', url);
      console.log('Writing models to', outDir)
      console.log('Writing depot code to', `${outDir}/${depotDirName}`);

      generate({
        url,
        outDir,
        include: include ? include.split(',') : null,
        exclude: exclude ? exclude.split(',') : null,
        writeReactUtilities: react,
        idFieldName,
        depotDirName,
      });
    }
  )
  .demandCommand(1)
  .parse()