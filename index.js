import { compile } from "./jq.js"
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
    const data = Array.from(compile(expr)(JSON.parse(value)))
    return data.length === 1 ?
        typeof data[0] === "string"
            ? data[0]
            : JSON.stringify(data[0])
        : JSON.stringify(data)
}