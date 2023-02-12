import yargs from 'yargs';
import {hideBin} from "yargs/helpers";
import {generate} from "./generate";

yargs(hideBin(process.argv))
  .command('generate <url>', 'Generate models based on an introspection of the provided URL', build => build.string('url'), (argv) => {
    const { url } = argv;
    if (!url) throw new Error('URL must be provided');

    console.log('Making introspection query to', url);

    generate(url);
  })
  .demandCommand(1)
  .parse()