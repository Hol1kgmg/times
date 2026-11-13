// CSS の @custom-media は JS から読めないので、global.css の --narrow と同じ幅を写す
export const narrowQuery = () => window.matchMedia("(max-width: 767px)");
