const DEFAULT_DOMAIN = "mypurecloud.com";
const NON_STANDARD_DOMAINS = [
  "inindca.com",
  "inintca.com",
  "mypurecloud.com.au",
  "mypurecloud.com",
  "mypurecloud.de",
  "mypurecloud.ie",
  "mypurecloud.jp"
  // 'use2.us-gov-pure.cloud', Assets are not currently deployed to FedRAMP. It should fall back to the default domain.
];
function getComponentAssetsOrigin() {
  return getAssetsOrigin();
}
function getChartComponentAssetsOrigin() {
  return getAssetsOrigin();
}
function getAssetsOrigin() {
  const matchedDomain = getRegionDomain();
  return `https://app.${matchedDomain || DEFAULT_DOMAIN}`;
}
function getFontOrigin() {
  return getComponentAssetsOrigin();
}
function getRegionDomain() {
  const pageHost = window.location.hostname;
  if (pageHost.endsWith(".pure.cloud")) {
    return pageHost.split(".").slice(-3).join(".");
  }
  return NON_STANDARD_DOMAINS.find(
    (regionDomain) => pageHost.endsWith(regionDomain)
  );
}

var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
function checkAndLoadScript(scriptSrc) {
  const existingTag = document.querySelector(`script[src="${scriptSrc}"]`);
  if (existingTag) {
    return Promise.resolve();
  } else {
    const scriptTag = document.createElement("script");
    scriptTag.setAttribute("type", "module");
    scriptTag.setAttribute("src", scriptSrc);
    const result = new Promise((resolve, reject) => {
      scriptTag.addEventListener("load", () => {
        resolve();
      });
      scriptTag.addEventListener("error", () => {
        reject(`Spark script failed to load: ${scriptSrc}`);
      });
    });
    document.head.appendChild(scriptTag);
    return result;
  }
}
function checkAndLoadStyle(styleHref) {
  const existingTag = document.querySelector(`link[href="${styleHref}"]`);
  if (existingTag) {
    return Promise.resolve();
  } else {
    const styleTag = document.createElement("link");
    styleTag.setAttribute("href", styleHref);
    styleTag.setAttribute("rel", "stylesheet");
    const result = new Promise((resolve, reject) => {
      styleTag.addEventListener("load", () => {
        resolve();
      });
      styleTag.addEventListener("error", () => {
        reject(`Spark styles failed to load: ${styleHref}`);
      });
    });
    document.head.appendChild(styleTag);
    return result;
  }
}
function checkAndLoadFonts(fonts) {
  const fontsToLoad = __spreadValues({}, fonts);
  document.fonts.forEach((fontFace) => {
    const normalizedFamily = fontFace.family.replace(/"/g, "");
    if (fontsToLoad[normalizedFamily]) {
      delete fontsToLoad[normalizedFamily];
    }
  });
  return Promise.all(
    Object.values(fontsToLoad).map((href) => {
      return checkAndLoadStyle(href).catch(() => {
        console.info(`genesys-spark: couldn't load font style ${href}`);
      });
    })
  ).then(() => {
  });
}

function getClosestElement(node, selector) {
  if (!node) {
    return null;
  }
  if (node instanceof ShadowRoot) {
    return getClosestElement(node.host, selector);
  }
  if (node instanceof HTMLElement) {
    if (node.matches(selector)) {
      return node;
    } else {
      return getClosestElement(node.parentNode, selector);
    }
  }
  return getClosestElement(node.parentNode, selector);
}

function dateTimeFormat(localeOrOptions, options) {
  let locale = void 0;
  if (typeof localeOrOptions === "string") {
    locale = localeOrOptions;
  } else {
    options = localeOrOptions;
  }
  if (locale != void 0) {
    return new Intl.DateTimeFormat(locale, options);
  } else {
    const userLocale = determineDisplayLocale();
    return new Intl.DateTimeFormat(userLocale, options);
  }
}
function relativeTimeFormat(localeOrOptions, options) {
  let locale = void 0;
  if (typeof localeOrOptions === "string") {
    locale = localeOrOptions;
  } else {
    options = localeOrOptions;
  }
  if (locale != void 0) {
    return new Intl.RelativeTimeFormat(locale, options);
  } else {
    const userLocale = determineDisplayLocale();
    return new Intl.RelativeTimeFormat(userLocale, options);
  }
}
function determineDisplayLocale(element = document.body) {
  var _a;
  const domLocale = (_a = getClosestElement(element, "*[lang]")) == null ? void 0 : _a.lang;
  if (!domLocale || browserHasRegionData(domLocale)) {
    return navigator.language;
  } else {
    return domLocale;
  }
}
function browserHasRegionData(localeString) {
  return localeString.length == 2 && navigator.language.startsWith(`${localeString}-`);
}
function getFormat(locale) {
  const date = /* @__PURE__ */ new Date("July 5, 2000 15:00:00 UTC+00:00");
  const options = {
    year: "numeric",
    month: "numeric",
    day: "numeric"
  };
  const dateTimeFormat2 = new Intl.DateTimeFormat(
    locale,
    options
  );
  const parts = dateTimeFormat2.formatToParts(date);
  const dateString = parts.map(({ type, value }) => {
    switch (type) {
      case "day":
        return `dd`;
      case "month":
        return `mm`;
      case "year":
        return `yyyy`;
      default:
        return value;
    }
  }).join("");
  return dateString.replace(/\s/g, "").replace(/‏/g, "");
}

var intl = /*#__PURE__*/Object.freeze({
  __proto__: null,
  dateTimeFormat: dateTimeFormat,
  determineDisplayLocale: determineDisplayLocale,
  getFormat: getFormat,
  relativeTimeFormat: relativeTimeFormat
});

const COMPONENT_ASSET_PREFIX = "/spark-components/build-assets/4.33.1-163/genesys-webcomponents/";
const CHART_COMPONENT_ASSET_PREFIX = "/spark-components/build-assets/4.33.1-163/genesys-chart-webcomponents/";
function loadSparkFonts() {
  const fontOrigin = getFontOrigin();
  const FONTS = {
    Urbanist: `${fontOrigin}/webfonts/urbanist.css`,
    "Noto Sans": `${fontOrigin}/webfonts/noto-sans.css`
  };
  return checkAndLoadFonts(FONTS);
}
function registerSparkComponents() {
  const SCRIPT_PATH = "genesys-webcomponents.esm.js";
  const STYLE_PATH = "genesys-webcomponents.css";
  const assetsOrigin = getComponentAssetsOrigin();
  const SCRIPT_SRC = `${assetsOrigin}${COMPONENT_ASSET_PREFIX}${SCRIPT_PATH}`;
  const STYLE_HREF = `${assetsOrigin}${COMPONENT_ASSET_PREFIX}${STYLE_PATH}`;
  return Promise.all([
    checkAndLoadScript(SCRIPT_SRC),
    checkAndLoadStyle(STYLE_HREF),
    loadSparkFonts()
  ]).then();
}
function registerSparkChartComponents() {
  const SCRIPT_PATH = "genesys-chart-webcomponents.esm.js";
  const STYLE_PATH = "genesys-chart-webcomponents.css";
  const assetsOrigin = getChartComponentAssetsOrigin();
  const SCRIPT_SRC = `${assetsOrigin}${CHART_COMPONENT_ASSET_PREFIX}${SCRIPT_PATH}`;
  const STYLE_HREF = `${assetsOrigin}${CHART_COMPONENT_ASSET_PREFIX}${STYLE_PATH}`;
  return Promise.all([
    checkAndLoadScript(SCRIPT_SRC),
    checkAndLoadStyle(STYLE_HREF),
    loadSparkFonts()
  ]).then();
}

//export { intl as Intl, loadSparkFonts, registerSparkChartComponents, registerSparkComponents };
