document.addEventListener("nav", (e: CustomEventMap["nav"]) => {
  const element = document.getElementById("disqus_thread");
  if (!element) return;
  loadDisqusForRoute({
    url: `${window.location.origin}/${element.dataset.url ?? ""}`,
    identifier: element.dataset.identifier ?? ""
  });
})

function loadDisqusForRoute({ url, identifier }: { url: string, identifier: string }) {
  if (!(window as any).DISQUS) {
    (window as any).disqus_config = function () {
      (this as any).page.url = url;
      (this as any).page.identifier = identifier;
    };

    const d = document;
    const s = d.createElement('script');
    s.src = 'https://adamtll-blog.disqus.com/embed.js';
    s.setAttribute('data-timestamp', String(+new Date()));
    (d.head || d.body)?.appendChild(s);
    return;
  }

  // Subsequent route changes: reset Disqus
  (window as any).DISQUS.reset({
    reload: true,
    config: function () {
      this.page.url = url;
      this.page.identifier = identifier;
    },
  });
}
