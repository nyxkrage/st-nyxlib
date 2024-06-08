import { compile } from "./jq.js"
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { getContext } from '../../../extensions.js';
import { isTrueBoolean } from '../../../utils.js';
import { getWorldInfoPrompt } from '../../../world-info.js';
import { resolveVariable, setLocalVariable } from '../../../variables.js';
import { activateSendButtons, deactivateSendButtons, generateQuietPrompt, getMaxContextSize } from '../../../../script.js';
import { addEphemeralStoppingString, flushEphemeralStoppingStrings } from '../../../power-user.js';


import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';

async function worldInfoPrefill(args, value) {
    const chat = window.SillyTavern.getContext().chat.filter(m => !m.is_system).map(m => `${m.name}: ${m.mes}`)
    const wi = await getWorldInfoPrompt([...chat, `Seraphina: ${value}`].reverse(), getMaxContextSize())
    setLocalVariable("worldInfoBefore", wi.worldInfoBefore)
    setLocalVariable("worldInfoAfter", wi.worldInfoAfter)
}

async function generateCallback(args, value) {
    // Prevent generate recursion
    $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));
    const lock = isTrueBoolean(args?.lock);
    const quietToLoud = true
    const length = Number(resolveVariable(args?.length) ?? 0) || 0;
    const context = getContext();

    try {
        if (lock) {
            deactivateSendButtons();
        }

        setEphemeralStopStrings(resolveVariable(args?.stop));
        const name = context["characters"][context.characterId].name;
        const result = await generateQuietPrompt(undefined, quietToLoud, false, '', name, length);
        return result;
    } finally {
        if (lock) {
            activateSendButtons();
        }
        flushEphemeralStoppingStrings();
    }
}

function setEphemeralStopStrings(value) {
    if (typeof value === 'string' && value.length) {
        try {
            const stopStrings = JSON.parse(value);
            if (Array.isArray(stopStrings)) {
                stopStrings.forEach(stopString => addEphemeralStoppingString(stopString));
            }
        } catch {
            // Do nothing
        }
    }
}

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'prefillwi',
    callback: worldInfoPrefill,
    returns: 'nothing',
    namedArgumentList: [
        new SlashCommandNamedArgument(
            'lock', 'lock user input during generation', [ARGUMENT_TYPE.BOOLEAN], false, false, null, ['on', 'off'],
        ),
        new SlashCommandNamedArgument(
            'length', 'API response length in tokens', [ARGUMENT_TYPE.NUMBER], false,
        ),
    ],
    helpString: `
        <div>
            Generates text using the current chat and passes it to the next command through the pipe, optionally locking user input while generating.
        </div>
    `,
}));

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'genchar',
    callback: generateCallback,
    returns: 'generated text',
    namedArgumentList: [
        new SlashCommandNamedArgument(
            'lock', 'lock user input during generation', [ARGUMENT_TYPE.BOOLEAN], false, false, null, ['on', 'off'],
        ),
        new SlashCommandNamedArgument(
            'length', 'API response length in tokens', [ARGUMENT_TYPE.NUMBER], false,
        ),
    ],
    helpString: `
        <div>
            Generates text using the current chat and passes it to the next command through the pipe, optionally locking user input while generating.
        </div>
    `,
}));

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