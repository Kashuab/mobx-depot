#!/usr/bin/env node
import yargs from 'yargs';
import {hideBin} from "yargs/helpers";
import {generate} from "./generate";
import {resolve} from "path";

const argv = hideBin(process.argv).filter(s => s !== '--');

yargs(argv)
  .command(
    'generate <url>',
    'Generate models based on an introspection of the provided schema',
    build => (
      build
        .string('url').describe('url', 'Schema source. Can be a URL to introspect, a path to a schema.graphql file, or an already compiled introspection.json')
        .string('out').describe('out', 'Path to codegen file (i.e. src/depot.ts)')
        .string('include').describe('include', 'Gatekeep which object types get generated into models (Comma-separated values)')
        .string('exclude').describe('exclude', 'Exclude certain object types from being generated into models (Comma-separated values)')
        .boolean('react').describe('react', 'Include React utilities in generated output (defaults to "true")')
        .string('idFieldName').describe('idFieldName', 'Name of the field used to identify object types (defaults to "id")')
    ),
    (argv) => {
      const { url, out = 'src/depot.ts', include, exclude, react = true, idFieldName = 'id', depotDirName = "depot" } = argv;
      if (!url) throw new Error('URL must be provided');

      console.log('Making introspection query to', url);
      console.log('Writing depot code to', resolve(out));

      generate({
        url,
        out,
        include: include ? include.split(',') : null,
        exclude: exclude ? exclude.split(',') : null,
        writeReactUtilities: react,
        idFieldName,
      });
    }
  )
  .demandCommand(1)
  .parse()