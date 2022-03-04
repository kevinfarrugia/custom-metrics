[crawlableURLs]
const BASE_HOST = new URL(location.href).host;

function getLcpEntry() {
  return new Promise((resolve) => {
    new PerformanceObserver((entryList) => {
      const lcpCandidates = entryList.getEntries();
      resolve(lcpCandidates[lcpCandidates.length - 1]);
    }).observe({type: 'largest-contentful-paint', buffered: true});
  });
}

function getLcpUrl(lcpElement) {
  const lcpAnchor = getNearestAncestor(lcpElement, 'a');
  if (!lcpAnchor) {
    return null;
  }

  const lcpUrl = new URL(lcpAnchor.href, location.href);
  if (!isSameHost(lcpUrl)) {
    return null;
  }

  return lcpUrl.href;
}

function getNearestAncestor(element, selector, maxDepth=50) {
  if (maxDepth < 1) {
    return null;
  }

  if (!element) {
    return null;
  }

  if (element.matches(selector)) {
    return element;
  }

  return getNearestAncestor(element.parentElement, selector, maxDepth - 1);
}

function isSameHost(url) {
  return url.host == BASE_HOST;
}



const lcpUrl = getLcpEntry().then(({element}) => {
  return getLcpUrl(element);
});

return Promise.all([lcpUrl]).then(([lcpUrl]) => {
  const crawlableUrls = [];

  if (lcpUrl) {
    crawlableUrls.push({
      label: 'LCP anchor',
      url: lcpUrl
    });
  }

  return crawlableUrls;
});