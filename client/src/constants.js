
// In PROD, Jinja would pass the host url to the window object as apiURL
const URL = window.apiURL === '{{ ip }}' ? 'http://192.168.0.166:5005' : window.apiURL;
const API_URL = `${URL}/api/v1`;

const IO_TRANSPORTS = {
    transports: ["websocket", "polling"],
}

const tileColors = {
    normal: "bg-white",
    tripleWord: "bg-red-700",
    startTile: "bg-gray-500",
    doubleLetter: "bg-blue-400",
    tripleLetter: "bg-blue-800",
    doubleWord: "bg-yellow-500",
}


// Allow string capitalization ("".capitalize())
String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
}

export { URL };
export { API_URL };
export { tileColors };
export { IO_TRANSPORTS };