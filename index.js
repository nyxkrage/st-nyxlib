import { chat_metadata, getRequestHeaders, saveSettingsDebounced } from '../../../../script.js';
import { saveMetadataDebounced, extension_settings, renderExtensionTemplate } from '../../../extensions.js';
import { executeSlashCommands, registerSlashCommand } from '../../../slash-commands.js';
import { debounce } from '../../../utils.js';
//@ts-expect-error
import extensionMetadata from './manifest.json' assert { type: "json" }
//@ts-expect-error
import { compile } from "https://esm.sh/@sscots/jqjs@1.1.0"

/**
 * @typedef {Object} QuickReplyOptions
 * @property {boolean} [hidden] whether the button should be hidden
 * @property {boolean} [startup] auto execute on app startup
 * @property {boolean} [user] auto execute on user message
 * @property {boolean} [bot] auto execute on AI message
 * @property {boolean} [load] auto execute on chat load
 */

const weatherUpdateScript = () => `/fetch https://api.open-meteo.com/v1/forecast?latitude=${extension_settings.nyxlib.latitude ?? "00.00"}&longitude=${extension_settings.nyxlib.longitude ?? "00.00"}&current=apparent_temperature,rain,snowfall,cloud_cover&wind_speed_unit=ms&timeformat=unixtime&forecast_days=1 |\n/jq expr={\"temp\":.current.apparent_temperature,\"rainfall\":.current.rain,\"snowfall\":.current.snowfall,\"cloudcover\":.current.cloud_cover} |\n/setobjectvar |\n/setvar key=cloudcover_state overcast |\n/if left=cloudcover right=80 rule=lt \"/setvar key=cloudcover_state mostly cloudy\" |\n/if left=cloudcover right=50 rule=lt \"/setvar key=cloudcover_state partly cloudy\" |\n/if left=cloudcover right=20 rule=lt \"/setvar key=cloudcover_state mostly clear\" |\n/setvar key=rainfall_state heavy |\n/if left=rainfall right=7.6 rule=lt \"/setvar key=rainfall_state moderate\" |\n/if left=rainfall right=2.6 rule=lt \"/setvar key=rainfall_state light\" |\n/if left=rainfall right=0.1 rule=lt \"/setvar key=rainfall_state no\" |\n/setvar key=snowfall_state heavy |\n/if left=snowfall right=7.6 rule=lt \"/setvar key=snowfall_state moderate\" |\n/if left=snowfall right=2.6 rule=lt \"/setvar key=snowfall_state light\" |\n/if left=snowfall right=0.1 rule=lt \"/setvar key=snowfall_state no\" |\n/setvar key=temp_state very hot |\n/if left=temp right=40 rule=lt \"/setvar key=temp_state hot\" |\n/if left=temp right=30 rule=lt \"/setvar key=temp_state warm\" |\n/if left=temp right=25 rule=lt \"/setvar key=temp_state comfortable\" |\n/if left=temp right=15 rule=lt \"/setvar key=temp_state chilly\" |\n/if left=temp right=10 rule=lt \"/setvar key=temp_state cold\" |\n/if left=temp right=0 rule=lt \"/setvar key=temp_state very cold \\| /mul temp -1 \\| /setvar key=temp minus \\{\\{getvar::temp\\}\\}\" |\n/if left=temp right=0 rule=lt \"/echo minus {{getvar::temp}}\" |\n/setglobalvar key=weatherreport The weather is {{getvar::temp_state}} at {{getvar::temp}} degrees, the sky is {{getvar::cloudcover_state}}, there is {{getvar::snowfall_state}} snowfall and {{getvar::rainfall_state}} rainfall. | /echo Updated Weather Report`

/**
 * @param {string} label text on the button and the name to be used with /run
 * @param {string} message the message to be sent when the button is clicked
 * @param {QuickReplyOptions} options
 */
function createQuickReply(label, message, options = {}) {
    executeSlashCommands(`/qr-create label=${label} hidden=${options.hidden ?? false} startup=${options.startup ?? false} user=${options.user ?? false} bot=${options.bot ?? false} load=${options.load ?? false} ${message.replaceAll("|", "\\|").replaceAll("{{", "\\{\\{").replaceAll("}}", "\\}\\}")}`);
}

/**
 * @param {string} label text on the button and the name to be used with /run
 * @param {string} message the message to be sent when the button is clicked
 * @param {QuickReplyOptions} options
 */
function updateQuickReply(label, message, options = {}) {
    let command = `/qr-update label=${label}`;
    for (const key in options) {
        command += ` ${key}=${options[key]}`;
    }
    command += ` ${message.replaceAll("|", "\\|").replaceAll("{{", "\\{\\{").replaceAll("}}", "\\}\\}")}`;
    executeSlashCommands(command);
}

function deleteQuickReply(label) {
    executeSlashCommands(`/qr-delete ${label}`);
}

function updateWeatherQuickReplies(e) {
    if (!e.target.checked) {
        // unregister quick replies
        // extension_settings.quickReply.quickReplySlots = extension_settings.quickReply.quickReplySlots.filter((slot) =>
        //     !(slot.label === "weather_set_timers" || slot.label === "weather_update_timer" || slot.label === "weather_update")
        // )
        // extension_settings.quickReply.numberOfSlots = extension_settings.quickReply.quickReplySlots.length;
        extension_settings.nyxlib.weatherreport_enabled = false;
        for (const label of ["weather_set_timers", "weather_update_timer", "weather_update"]) {
            deleteQuickReply(label);
        }
        saveSettingsDebounced();
        return
    }
    if (!extension_settings.quickReply.quickReplyEnabled) {
        toastr.error("quickReply is disabled, cannot register quick replies for weather report", undefined);
        e.target.checked = false;
        saveSettingsDebounced();
        return
    }
    createQuickReply("weather_update", weatherUpdateScript(), {
        hidden: true
    });
    createQuickReply("weather_update_timer", `/setglobalvar key=currenttime {{datetimeformat X}} |\n/sub currenttime last_weather_update |\n/setvar key=elapsed |\n/if left=elapsed right=120 rule=gt \"/setglobalvar key=last_weather_update {{getglobalvar::currenttime}} \\| /run weather_update\" |\n/flushvar elapsed`, {
        hidden: true,
        bot: true,
        user: true,
        load: true
    });
    createQuickReply("weather_set_timers", `/setglobalvar key=currenttime {{datetimeformat X}} |\n/setglobalvar key=last_weather_update {{getglobalvar::currenttime}}`, {
        hidden: true,
        startup: true
    });
    extension_settings.nyxlib.weatherreport_enabled = true;
    saveSettingsDebounced();
}

function updateLocation() {
    extension_settings.nyxlib.latitude = $('#weatherreport_latitude').val();
    extension_settings.nyxlib.longitude = $('#weatherreport_longitude').val();
    updateQuickReply("weather_update", weatherUpdateScript(), {})
    saveSettingsDebounced();
}

/**
 * Load the settings HTML and append to the designated area.
 */
async function loadSettingsHTML() {
    const settingsHtml = renderExtensionTemplate(extensionMetadata.extension_name, 'dropdown');
    console.log(extension_settings)
    extension_settings.nyxlib = extension_settings.nyxlib ?? {
        weatherreport_enabled: false,
        latitude: "00.00",
        longitude: "00.00"
    };
    saveSettingsDebounced();
    $('#extensions_settings2').append(settingsHtml);

    $('#weatherreport_latitude').val(extension_settings.nyxlib.latitude ?? "00.00");
    $('#weatherreport_longitude').val(extension_settings.nyxlib.longitude ?? "00.00");
    $('#weatherreport_enabled')[0].checked = extension_settings.nyxlib.weatherreport_enabled ?? false;
    $('#weatherreport_enabled').on('input', debounce(updateWeatherQuickReplies, 250));
    $('#weatherreport_update_location').on('click', debounce(updateLocation, 250));
}

jQuery(async () => {
    await loadSettingsHTML();
})

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
