import { chat_metadata } from '../../../script.js';
import { saveMetadataDebounced } from '../../extensions.js';
import { registerSlashCommand } from '../../slash-commands.js';
import { compile } from "https://esm.sh/@sscots/jqjs@1.1.0"

function setLocalVariable(name, value) {
    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    chat_metadata.variables[name] = value;
    saveMetadataDebounced();
    return value;
}


function jq(args, value) {
    let data = Array.from(compile(args.expr)(JSON.parse(value)))[0]
    return typeof data === "object" ? JSON.stringify(data) : data.toString()
}

registerSlashCommand("jq", jq, [], "Run a jq expression over the provided json string", true, true)

registerSlashCommand("fetch", (args, value) => {
    if (value.at(-1) == "'" || value.at(-1) == '"') {
        value = value.slice(0, value.length - 1)
    }
    if (value.at(0) == "'" || value.at(0) == '"') {
        value = value.slice(1)
    }
    let xhr = new XMLHttpRequest();
    xhr.open(args.method ?? "GET", value, false);
    xhr.send(args.body);
    return xhr.responseText
}, [], "Make a webrequest", true, true)

function format(args, value) {
    args = JSON.parse(args.args);
    var key;
    for (key in args) {
        value = value.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
    }
    return value
}

registerSlashCommand("format", format, [], "Format a string with a given JSON object as arguments", true, true)

registerSlashCommand("setobjectvar", (_args, value) => {
    const obj = JSON.parse(value);
    for (const key in obj) {
        setLocalVariable(key, obj[key])
    }
}, "Set variables for each key of a json object", true, true)
