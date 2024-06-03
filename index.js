import { compile } from "https://esm.sh/@sscots/jqjs@1.1.0"
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'jq',
    callback: (args, value) => {
        return jq(args.expr, value)
    },
    namedArgumentList: [
        SlashCommandNamedArgument.fromProps({ name: "expr",
            description: 'jq expression to execute',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        })
    ],
    unnamedArgumentList: [
        SlashCommandArgument.fromProps({
            description: 'The JSON string to execute the jq query over',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        }),
    ],
    helpString: "Run a jq expression over the provided json string",
}));

function jq(expr, value) {
    let data = Array.from(compile(expr)(JSON.parse(value)))[0]
    return typeof data === "object" ? JSON.stringify(data) : data.toString()
}