(() => {
  const isFirstLoad = !localStorage.getItem('img_retry_once');

  if (isFirstLoad) {
    window.addEventListener('load', () => {
      const imgs = document.querySelectorAll('img');
      imgs.forEach(img => {
        let retried = false;

        img.onerror = () => {
          if (!retried) {
            retried = true;
            setTimeout(() => {
              const oldSrc = img.src;
              img.src = '';
              img.src = oldSrc;
            }, 300);
          }
        };
      });

      localStorage.setItem('img_retry_once', '1');
    });
  }
})();
