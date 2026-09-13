(function () {
  const marketplaceLabels = {
    wb: "Wildberries",
    ym: "Яндекс Маркет",
    ozon: "Ozon",
  };

  const defaultConfig = {
    theme: {
      accent: "#68478D",
      accentInk: "#ffffff",
      text: "#2A2630",
      muted: "#6E6877",
      panel: "#ffffff",
      border: "#E7DFD7",
      star: "#C99A3F",
      dark: false,
    },
    appearance: {
      preset: "default",
      viewAllHref: "",
    },
    typography: {
      fontFamily: "",
      inheritSite: false,
      scale: 1,
      radius: 16,
      density: "comfortable",
    },
    layout: {
      mode: "list",
      columns: 2,
      pageSize: 3,
      sections: ["summary", "player", "media", "filters", "list", "form"],
      pagination: "more",
      mediacard: {
        layout: "row",
        aspect: "16:10",
        maxTiles: 4,
        plusMore: true,
      },
      player: {
        enabled: true,
        title: "Видео покупателей",
        tile: { aspect: "9:16", width: 156 },
        showAuthor: true,
        showLikes: true,
        showSourceBadge: true,
        autoAdvance: { enabled: true, intervalSec: 5, pauseOnHover: true },
      },
      wall: {
        minTileWidth: 200,
        gap: 12,
        maxTiles: 24,
      },
      video: {
        aspect: "9:16",
        tileWidth: 156,
        showSourceBadge: true,
        showAuthor: true,
        autoplayInViewer: true,
        productPanel: true,
      },
      tileHover: true,
    },
    header: {
      title: "Отзывы покупателей",
      layout: "row",
      elements: { title: true, rating: true, count: true, recommend: true, distribution: true },
    },
    answers: {
      style: "card",
      color: "#4E7C59",
      title: "",
      showTitle: true,
    },
    viewer: {
      chrome: "full",
      showOriginal: true,
      showCounter: true,
    },
    filters: {
      layout: "rows",
      collapsible: false,
      multiSelect: false,
      labelMode: "all",
    },
    form: {
      mode: "inline",
      title: "Оставить отзыв",
      submitLabel: "Отправить отзыв",
      fields: { title: true, email: true, media: true, prosCons: true },
      maxMedia: 3,
      mediaHint: "Фото до 8 МБ · видео до 50 МБ",
      cta: { text: "Оставить отзыв", hint: "Помогите другим покупателям — оценка, текст, фото или видео" },
      // Где кнопка формы: section (CTA-полоса) | header | both (макет: form.cta)
      ctaMode: "section",
    },
    customTags: {
      display: "chips",
      chipLabel: true,
    },
    visibility: {
      photos: true,
      sellerAnswers: true,
      prosCons: true,
      marketplaceBadges: true,
      ratingDistribution: true,
      videoRail: true,
      filters: true,
      questions: true,
    },
    labels: {
      writeReview: "Написать отзыв",
      readMore: "Читать полностью",
      search: "Поиск по отзывам",
      viewAll: "Смотреть все",
      recentlyAdded: "Недавно",
    },
    defaults: {
      minRating: 4,
      requireText: true,
      requirePhoto: false,
      marketplace: "all",
      initialSort: "relevance",
      textFirst: true,
      photoFirst: true,
      onlyWithAnswer: false,
    },
    ranking: [
      { field: "pinned", direction: "desc" },
      { field: "hasPhoto", direction: "desc" },
      { field: "hasText", direction: "desc" },
      { field: "rating", direction: "desc" },
      { field: "createdAt", direction: "desc" },
    ],
    marketplacePolicy: {
      wb: { hidden: false, label: "", showSourceLinks: true },
      ym: { hidden: false, label: "", showSourceLinks: true },
      ozon: { hidden: false, label: "", showSourceLinks: true },
    },
  };

  const sampleReviews = [
    {
      marketplace: "wb",
      externalReviewId: "wb-1001",
      externalProductId: "70476012",
      sellerArticle: "1523",
      title: "Платье как на модели",
      product: { name: "Платье миди «Аметист»", price: "4 590 ₽" },
      marketplaceReviewUrl: "https://www.wildberries.ru/catalog/70476012/detail.aspx#comments",
      marketplaceProductUrl: "https://www.wildberries.ru/catalog/70476012/detail.aspx",
      sellerProductUrl: "https://example-shop.test/search?query=1523",
      rating: 5,
      authorName: "Юлиана",
      text: "Платье село идеально, цвет как на фото у покупательниц. Ткань плотная, не просвечивает.",
      pros: "Плюсы: посадка, ткань",
      cons: "",
      createdAt: "2026-05-28T12:20:00+03:00",
      custom: { height: "164", size: "46" },
      media: [
        { kind: "video", url: "./assets/demo-review-1.mp4", previewUrl: "./assets/review-video.svg", likes: 124, duration: 24 },
        { kind: "photo", url: "./assets/review-fabric.svg", likes: 0, duration: 0 },
        { kind: "photo", url: "./assets/review-outfit.svg", likes: 0, duration: 0 },
      ],
      answer: {
        text: "Спасибо, Юлиана! Носите с удовольствием.",
        state: "published",
      },
    },
    {
      marketplace: "ozon",
      externalReviewId: "oz-772",
      sellerArticle: "1523",
      title: "Примерка на видео",
      product: { name: "Платье миди «Аметист»", price: "4 590 ₽" },
      rating: 4,
      authorName: "Марина",
      text: "Сняла видео примерки: село по фигуре, не тянет в плечах. Вторая неделя носки — складки не мнутся.",
      pros: "",
      cons: "",
      createdAt: "2026-05-27T18:30:00+03:00",
      custom: { height: "170" },
      media: [{ kind: "video", url: "./assets/demo-review-2.mp4", previewUrl: "./assets/review-video.svg", likes: 86, duration: 31 }],
      answer: null,
    },
    {
      marketplace: "ym",
      externalReviewId: "ym-2107",
      externalProductId: "SKU-2107",
      sellerArticle: "2107",
      product: { name: "Платье миди «Аметист»", price: "4 590 ₽" },
      marketplaceReviewUrl: "",
      marketplaceProductUrl: "",
      sellerProductUrl: "./product.html?article=SKU-2107&marketplace=ym",
      rating: 5,
      authorName: "Дарья",
      text: "Подкладка не сбивается, швы ровные. Беру второе платье, теперь в синем.",
      pros: "Плюсы: подкладка, швы",
      cons: "",
      createdAt: "2026-05-27T09:10:00+03:00",
      custom: { size: "44" },
      media: [],
      answer: {
        text: "Спасибо, Дарья! Носите с удовольствием.",
        state: "published",
      },
    },
    {
      marketplace: "wb",
      externalReviewId: "wb-1003",
      externalProductId: "70476012",
      sellerArticle: "1523",
      product: { name: "Платье миди «Аметист»", price: "4 590 ₽" },
      marketplaceReviewUrl: "https://www.wildberries.ru/catalog/70476012/detail.aspx#comments",
      marketplaceProductUrl: "https://www.wildberries.ru/catalog/70476012/detail.aspx",
      sellerProductUrl: "https://example-shop.test/search?query=1523",
      rating: 5,
      authorName: "Ирина",
      text: "Взяла после того, как увидела фото в галерее — сразу видно, как сидит оттенок.",
      pros: "",
      cons: "",
      createdAt: "2026-05-26T17:42:00+03:00",
      custom: { height: "158" },
      media: [
        { kind: "photo", url: "./assets/review-outfit.svg", likes: 96, duration: 0 },
        { kind: "photo", url: "./assets/review-fabric.svg", likes: 0, duration: 0 },
      ],
      answer: null,
    },
    {
      marketplace: "ozon",
      externalReviewId: "oz-771",
      rating: 3,
      authorName: "Вера",
      sellerArticle: "771",
      product: { name: "Платье миди «Аметист»", price: "4 590 ₽" },
      marketplaceReviewUrl: "",
      marketplaceProductUrl: "",
      media: [{ kind: "photo", url: "./assets/review-label.svg", likes: 12, duration: 0 }],
      text: "Пришло быстро, но цвет чуть темнее, чем на фото. Надеюсь, выгорит.",
      pros: "",
      cons: "",
      createdAt: "2026-05-25T20:05:00+03:00",
      custom: {},
    },
    {
      marketplace: "wb",
      externalReviewId: "wb-1004",
      externalProductId: "70476012",
      sellerArticle: "1523",
      product: { name: "Платье миди «Аметист»", price: "4 590 ₽" },
      marketplaceReviewUrl: "https://www.wildberries.ru/catalog/70476012/detail.aspx#comments",
      marketplaceProductUrl: "https://www.wildberries.ru/catalog/70476012/detail.aspx",
      sellerProductUrl: "https://example-shop.test/search?query=1523",
      rating: 5,
      authorName: "Полина",
      text: "",
      pros: "",
      cons: "",
      createdAt: "2026-05-24T14:12:00+03:00",
      custom: { size: "46" },
      media: [
        { kind: "photo", url: "./assets/review-fabric.svg", likes: 74, duration: 0 },
        { kind: "photo", url: "./assets/review-outfit.svg", likes: 0, duration: 0 },
      ],
      answer: null,
    },
    {
      marketplace: "ym",
      externalReviewId: "ym-2109",
      externalProductId: "SKU-2109",
      sellerArticle: "2109",
      product: { name: "Платье миди «Аметист»", price: "4 590 ₽" },
      marketplaceReviewUrl: "",
      marketplaceProductUrl: "",
      sellerProductUrl: "./product.html?article=SKU-2109&marketplace=ym",
      rating: 4,
      authorName: "Ника",
      text: "Стрейч 8–10 см по обхвату — село как влитое на 46 размер.",
      pros: "",
      cons: "",
      createdAt: "2026-05-23T11:02:00+03:00",
      custom: { size: "46" },
      media: [{ kind: "photo", url: "./assets/review-label.svg", likes: 0, duration: 0 }],
      answer: {
        text: "Спасибо за замеры, Ника! Это полезно другим покупателям.",
        state: "published",
      },
    },
    {
      marketplace: "wb",
      externalReviewId: "wb-1005",
      externalProductId: "70476012",
      sellerArticle: "1523",
      product: { name: "Платье миди «Аметист»", price: "4 590 ₽" },
      marketplaceReviewUrl: "https://www.wildberries.ru/catalog/70476012/detail.aspx#comments",
      marketplaceProductUrl: "https://www.wildberries.ru/catalog/70476012/detail.aspx",
      sellerProductUrl: "https://example-shop.test/search?query=1523",
      rating: 5,
      authorName: "Соня",
      text: "Длина миди как на модели: до середины икры при росте 168.",
      pros: "",
      cons: "",
      createdAt: "2026-05-22T16:20:00+03:00",
      custom: { height: "168" },
      media: [],
      answer: null,
    },
  ];

  function mount(root, options) {
    if (!root) {
      throw new Error("ReviewsWidget root is required");
    }
    options = options || {};
    const config = normalizeConfig(options.config);
    const context = options.context || "product";
    const initialReviews = normalizeReviews(options.reviews || [], config);

    const state = {
      reviews: initialReviews,
      aggregate: shouldTrustAggregate(config) ? normalizeAggregate(options.aggregate) : null,
      // Макетная FEED: отдельная лента медиа (не привязана к отзывам 1:1).
      // Опционально приходит mount-опцией feed: [{kind,url,previewUrl,likes,duration,authorName,marketplace}].
      // Без неё — как раньше, лента строится из media отзывов.
      feed: Array.isArray(options.feed) ? options.feed : null,
      config,
      context,
      marketplace: config.defaults.marketplace || "all",
      rating: "all",
      mediaFilter: "all",
      customFilters: {},
      customFiltersOpen: false,
      sort: options.initialSort || config.defaults.initialSort || "newest",
      visible: initialVisible(config),
      expanded: true,
      fullFeedSource: options.fullFeedSource || "",
      fullFeedLimit: clampNumber(options.fullFeedLimit, 1, 100, 24),
      fullFeedOffset: Number.isFinite(Number(options.fullFeedOffset)) ? Number(options.fullFeedOffset) : 0,
      fullFeedOffsetExplicit: Number.isFinite(Number(options.fullFeedOffset)),
      fullFeedExhausted: false,
      loadingMore: false,
      submissionUrl: options.submissionUrl || "",
      sellerArticle: options.sellerArticle || "",
      activeTab: "reviews",
      questions: {
        items: [],
        loading: false,
        loaded: false,
        error: "",
      },
      questionForm: {
        expanded: false,
        sending: false,
        message: "",
        error: "",
        openedAt: Date.now(),
      },
      submission: {
        config: options.submissionConfig || null,
        loading: Boolean(options.submissionConfigUrl && context === "product"),
        expanded: false,
        sending: false,
        message: "",
        error: "",
        openedAt: Date.now(),
      },
      loading: Boolean(options.source),
      error: "",
      searchQuery: "",
      expandedTexts: new Set(),
      moreError: "",
      pagerPage: 0,
      feedIndex: -1,
      feedTimer: null,
      feedPaused: false,
      viewerTimer: null,
      viewerPlaying: false,
      formModalOpen: false,
      formDone: false,
    };
    if (!state.fullFeedOffsetExplicit) {
      state.fullFeedOffset = state.reviews.length;
    }

    let proxyBase = options.mediaProxyBase || "";
    try {
      if (!proxyBase && options.source) {
        proxyBase = new URL(options.source, window.location.href).origin;
      }
    } catch (e) {
      proxyBase = "";
    }

    // Derive the API base for questions from the source URL origin (same server
    // that serves reviews). Falls back to submissionUrl origin, then empty.
    let questionsApiBase = options.questionsApiBase || "";
    if (!questionsApiBase) {
      try {
        if (options.source) {
          questionsApiBase = new URL(options.source, window.location.href).origin;
        } else if (options.submissionUrl) {
          questionsApiBase = new URL(options.submissionUrl, window.location.href).origin;
        }
      } catch (e) {
        questionsApiBase = "";
      }
    }
    state._questionsApiBase = questionsApiBase;
    state._publicKey = options.publicKey || "";

    root.innerHTML = "";
    root.classList.add("reviews-widget", "reviews-widget-root");
    applyConfig(root, state.config);
    root.__reviewsProxyBase = proxyBase;
    root.classList.toggle("rw-context-homepage", state.context === "homepage");
    root.classList.toggle("rw-is-expanded", state.expanded);
    root.appendChild(renderShell(options.productName || config.header.title, config));
    bind(root, state);
    render(root, state);

    if (options.source) {
      fetchReviews(options.source)
        .then((payload) => {
          state.reviews = normalizeReviews(payload.reviews, state.config);
          state.aggregate = shouldTrustAggregate(state.config) ? normalizeAggregate(payload.aggregate) : null;
          if (!state.fullFeedOffsetExplicit) {
            state.fullFeedOffset = state.reviews.length;
          }
          state.loading = false;
          state.error = "";
          render(root, state);
        })
        .catch((error) => {
          state.loading = false;
          state.error = error.message || "Не удалось загрузить отзывы";
          render(root, state);
        });
    }
    if (context === "product" && options.submissionConfigUrl) {
      fetchSubmissionConfig(options.submissionConfigUrl)
        .then((config) => {
          state.submission.config = config;
          state.submission.loading = false;
          render(root, state);
        })
        .catch(() => {
          state.submission.loading = false;
          render(root, state);
        });
    }
  }

  function renderShell(productName, config) {
    const fragment = document.createDocumentFragment();
    const header = document.createElement("div");
    header.className = "rw-header";
    header.setAttribute("data-section", "header");
    const showQuestions = !config || config.visibility.questions !== false;
    const labels = config.labels || {};
    const he = config.header.elements || defaultConfig.header.elements;
    header.innerHTML = `
      <div class="rw-tabs" aria-label="Разделы отзывов">
        <button class="rw-tab is-active" type="button" data-role="tab-reviews">Отзывы <sup data-role="review-count">0</sup></button>
        ${showQuestions ? `<button class="rw-tab" type="button" data-role="tab-questions">Вопросы <sup data-role="question-count">0</sup></button>` : ""}
        <button class="rw-write-cta" type="button" data-role="write-cta" hidden>${escapeHTML(labels.writeReview || "Написать отзыв")}</button>
      </div>
    `;

  function formCtaHeader(config) {
    return config.layout.sections.includes("form") && (config.form.ctaMode === "header" || config.form.ctaMode === "both");
  }
    // Шапка как в макете (w-head l-center): титул, счёт (big 30px + звёзды +
    // счётчик столбиком), полосы распределения, кнопка формы — всё в одном
    // грид-центре. data-roles сохранены для биндингов.
    const showScoreBlock = he.rating || he.count || he.recommend;
    const overview = document.createElement("div");
    overview.className = "rw-head";
    overview.setAttribute("data-section", "summary");
    overview.innerHTML = `
      ${he.title ? `<span class="rw-wtitle" data-role="widget-title">${escapeHTML(config.header.title || defaultConfig.header.title)}</span>` : ""}
      ${showScoreBlock ? `
      <span class="rw-sum">
        ${he.rating ? `<span class="rw-big" data-role="score">0.0</span>` : ""}
        <span>
          ${he.rating ? `<span class="rw-stars" data-role="stars" aria-label="Средний рейтинг"></span>` : ""}
          ${he.count ? `<span class="rw-count" data-role="summary" style="display:block"></span>` : ""}
        </span>
      </span>` : ""}
      ${he.distribution ? `<span class="rw-dist" data-role="distwrap"></span>` : ""}
      ${formCtaHeader(config) ? `<button class="rw-hbtn" type="button" data-role="head-cta">${escapeHTML(config.form.cta.text || defaultConfig.form.cta.text)}</button>` : ""}
    `;
    if (config.appearance.viewAllHref) {
      const viewAll = document.createElement("div");
      viewAll.className = "rw-view-all-row";
      viewAll.innerHTML = `<a class="rw-view-all" href="${escapeAttribute(config.appearance.viewAllHref)}" target="_blank" rel="noreferrer">${escapeHTML(labels.viewAll || "Смотреть все")}</a>`;
      overview.appendChild(viewAll);
    }

    const player = document.createElement("div");
    player.className = "rw-player-feed";
    player.setAttribute("data-role", "player-feed");
    player.setAttribute("data-section", "player");
    player.hidden = true;

    const media = document.createElement("div");
    media.className = "rw-media-strip";
    media.setAttribute("data-role", "media-strip");
    media.setAttribute("data-section", "media");

    const filterBar = document.createElement("div");
    filterBar.className = "rw-chips";
    filterBar.setAttribute("data-section", "filters");
    filterBar.innerHTML = `<div class="rw-chips-row" data-role="chips"></div>`;

    const listWrap = document.createElement("div");
    listWrap.className = "rw-list-wrap";
    listWrap.setAttribute("data-role", "panel-reviews");
    listWrap.setAttribute("data-section", "list");
    listWrap.innerHTML = `
      <div class="rw-wall-wrap" data-role="wall" hidden></div>
      <div class="rw-list" data-role="list"></div>
      <div class="rw-empty" data-role="status" hidden></div>
      <div class="rw-footer">
        <button class="rw-load-more" type="button" data-role="load-more">Показать ещё</button>
        <nav class="rw-pager" data-role="pager" hidden aria-label="Страницы отзывов"></nav>
      </div>
    `;

    const viewer = document.createElement("dialog");
    viewer.className = "rw-media-viewer";
    viewer.setAttribute("data-role", "media-viewer");
    const viewerCfg = config.viewer || defaultConfig.viewer;
    const viewerMin = viewerCfg.chrome === "min";
    viewer.innerHTML = `
      <div class="rw-media-dialog${viewerMin ? " rw-media-dialog-min" : ""}" data-role="viewer-dialog">
        ${viewerMin
          ? `<button class="rw-media-close rw-media-close-float" type="button" data-role="viewer-close" aria-label="Закрыть просмотр">×</button>`
          : `<div class="rw-media-dialog-top">
              <div class="rw-media-who" data-role="viewer-who">
                <span class="rw-avatar rw-who-avatar" data-role="viewer-avatar"></span>
                <span class="rw-who-line"><b data-role="viewer-name"></b><span class="rw-when" data-role="viewer-when"></span></span>
                <span class="rw-stars rw-who-stars" data-role="viewer-stars"></span>
              </div>
              <span class="rw-media-tools">
                <span class="rw-media-counter" data-role="viewer-count"></span>
                ${viewerCfg.showOriginal === false ? "" : `<a class="rw-media-original" data-role="viewer-original" href="#" target="_blank" rel="noreferrer">Открыть оригинал</a>`}
              </span>
              <button class="rw-media-close" type="button" data-role="viewer-close" aria-label="Закрыть просмотр">×</button>
            </div>`}
        <button class="rw-media-nav rw-media-prev" type="button" data-role="viewer-prev" aria-label="Предыдущее медиа">‹</button>
        <div class="rw-media-stage" data-role="viewer-stage"></div>
        <button class="rw-media-nav rw-media-next" type="button" data-role="viewer-next" aria-label="Следующее медиа">›</button>
        <button class="rw-media-play" type="button" data-role="viewer-play" aria-label="Пауза" hidden>
          <span class="rw-media-play-icon" aria-hidden="true"></span>
        </button>
        <span class="rw-media-progress" data-role="viewer-progress" hidden><i></i></span>
        ${viewerMin ? "" : `<div class="rw-media-queue" data-role="viewer-queue"></div>`}
      </div>
    `;

    const formModal = document.createElement("dialog");
    formModal.className = "rw-form-modal";
    formModal.setAttribute("data-role", "form-modal");
    formModal.setAttribute("aria-label", "Оставить отзыв");
    formModal.innerHTML = `
      <div class="rw-fm-card" role="dialog" aria-modal="true" aria-label="Оставить отзыв">
        <header class="rw-fm-top">
          <b data-role="form-modal-title"></b>
          <button class="rw-fm-close" type="button" data-role="form-modal-close" aria-label="Закрыть форму">×</button>
        </header>
        <div class="rw-fm-body" data-role="form-modal-body"></div>
      </div>
    `;

    const submitForm = document.createElement("div");
    submitForm.className = "rw-submit";
    submitForm.setAttribute("data-role", "submit");
    submitForm.setAttribute("data-section", "form");

    const questionsPanel = document.createElement("div");
    questionsPanel.className = "rw-questions-panel";
    questionsPanel.setAttribute("data-role", "panel-questions");
    questionsPanel.hidden = true;
    questionsPanel.innerHTML = `
      <div class="rw-qa-list" data-role="qa-list"></div>
      <div class="rw-empty" data-role="qa-status" hidden></div>
      <div class="rw-qa-submit" data-role="qa-submit"></div>
    `;

    // Header first, then the flat section children of the root in config order.
    fragment.appendChild(header);
    const bySection = { summary: overview, player, media, filters: filterBar, list: listWrap, form: submitForm };
    for (const id of config.layout.sections) {
      fragment.appendChild(bySection[id]);
    }
    fragment.append(questionsPanel, viewer, formModal);
    return fragment;
  }

  function bind(root, state) {
    if (root.__reviewsWidgetKeydown) {
      root.ownerDocument.removeEventListener("keydown", root.__reviewsWidgetKeydown);
    }
    root.__reviewsWidgetKeydown = (event) => {
      const viewer = root.querySelector('[data-role="media-viewer"]');
      if (viewer && viewer.open) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          shiftMediaViewer(root, -1, state);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          shiftMediaViewer(root, 1, state);
        }
        if (event.key === " ") {
          const target = event.target;
          if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return;
          event.preventDefault();
          toggleViewerPlay(root, state);
        }
        return;
      }
    };
    root.ownerDocument.addEventListener("keydown", root.__reviewsWidgetKeydown);

    if (root.__reviewsWidgetMediaClick) {
      root.removeEventListener("click", root.__reviewsWidgetMediaClick);
    }
    root.__reviewsWidgetMediaClick = (event) => {
      const close = event.target.closest('[data-role="viewer-close"]');
      if (close && root.contains(close)) {
        event.preventDefault();
        closeMediaViewer(root, state);
        return;
      }

      const nav = event.target.closest('[data-role="viewer-prev"], [data-role="viewer-next"]');
      if (nav && root.contains(nav)) {
        event.preventDefault();
        shiftMediaViewer(root, nav.getAttribute("data-role") === "viewer-prev" ? -1 : 1, state);
        return;
      }

      const trigger = event.target.closest("[data-media-viewer]");
      if (trigger && root.contains(trigger)) {
        event.preventDefault();
        event.stopPropagation();
        openMediaViewer(root, trigger, state);
        return;
      }
      const submitToggle = event.target.closest('[data-role="submit-toggle"]');
      if (submitToggle && root.contains(submitToggle)) {
        event.preventDefault();
        state.submission.expanded = !state.submission.expanded;
        state.submission.error = "";
        state.submission.message = "";
        render(root, state);
        return;
      }

      const writeCta = event.target.closest('[data-role="write-cta"]');
      if (writeCta && root.contains(writeCta)) {
        event.preventDefault();
        openFormModal(root, state);
        return;
      }

      const readMore = event.target.closest('[data-role="read-more"]');
      if (readMore && root.contains(readMore)) {
        event.preventDefault();
        const key = readMore.getAttribute("data-review-key");
        if (state.expandedTexts.has(key)) {
          state.expandedTexts.delete(key);
        } else {
          state.expandedTexts.add(key);
        }
        render(root, state);
        return;
      }
      const modalClose = event.target.closest('[data-role="form-modal-close"]');
      if (modalClose && root.contains(modalClose)) {
        event.preventDefault();
        closeFormModal(root, state);
        render(root, state);
        return;
      }
      const formDone = event.target.closest('[data-role="form-done"]');
      if (formDone && root.contains(formDone)) {
        event.preventDefault();
        state.formDone = false;
        closeFormModal(root, state);
        render(root, state);
        return;
      }
      const formAgain = event.target.closest('[data-role="form-again"]');
      if (formAgain && root.contains(formAgain)) {
        event.preventDefault();
        state.formDone = false;
        state.formRating = 0;
        state.formMedia = [];
        state.formError = "";
        state.submission.expanded = true;
        render(root, state);
        return;
      }
      const ctaOpen = event.target.closest('[data-role="form-cta-open"], [data-role="head-cta"]');
      if (ctaOpen && root.contains(ctaOpen)) {
        event.preventDefault();
        openFormModal(root, state);
        return;
      }
      const addMedia = event.target.closest('[data-role="form-add-media"]');
      if (addMedia && root.contains(addMedia)) {
        event.preventDefault();
        const input = addMedia.closest("form").querySelector('[data-role="form-media"]');
        if (input) input.click();
        return;
      }
      const starBtn = event.target.closest('[data-role="form-star"]');
      if (starBtn && root.contains(starBtn)) {
        event.preventDefault();
        state.formRating = Number(starBtn.getAttribute("data-star")) || 0;
        state.formError = "";
        render(root, state);
        return;
      }
      const thumbRemove = event.target.closest('[data-role="form-thumb-remove"]');
      if (thumbRemove && root.contains(thumbRemove)) {
        event.preventDefault();
        const idx = Number(thumbRemove.getAttribute("data-thumb-index"));
        if (state.formMedia) state.formMedia.splice(idx, 1);
        render(root, state);
        return;
      }
      const playBtn = event.target.closest('[data-role="viewer-play"]');
      if (playBtn && root.contains(playBtn)) {
        event.preventDefault();
        toggleViewerPlay(root, state);
        return;
      }
      const queueItem = event.target.closest('[data-role="viewer-queue"] [data-queue-index]');
      if (queueItem && root.contains(queueItem)) {
        event.preventDefault();
        const viewer = root.querySelector('[data-role="media-viewer"]');
        if (viewer && viewer.__items) {
          viewer.__index = Number(queueItem.getAttribute("data-queue-index")) || 0;
          renderMediaViewer(root, state);
          scheduleViewerTimer(root, state);
        }
        return;
      }

      const chip = event.target.closest("[data-custom-field]");
      if (chip && root.contains(chip)) {
        const group = chip.closest("[data-custom-chips]");
        if (group) {
          const already = chip.getAttribute("aria-pressed") === "true";
          group.querySelectorAll("[data-custom-value]").forEach((button) => button.setAttribute("aria-pressed", "false"));
          chip.setAttribute("aria-pressed", already ? "false" : "true");
          const hidden = group.querySelector('input[type="hidden"]');
          if (hidden) hidden.value = already ? "" : chip.getAttribute("data-custom-value");
        }
        return;
      }

      const tabReviews = event.target.closest('[data-role="tab-reviews"]');
      if (tabReviews && root.contains(tabReviews)) {
        event.preventDefault();
        if (state.activeTab !== "reviews") {
          state.activeTab = "reviews";
          render(root, state);
        }
        return;
      }

      const tabQuestions = event.target.closest('[data-role="tab-questions"]');
      if (tabQuestions && root.contains(tabQuestions)) {
        event.preventDefault();
        if (state.activeTab !== "questions") {
          state.activeTab = "questions";
          render(root, state);
          if (!state.questions.loaded && !state.questions.loading) {
            loadQuestions(root, state);
          }
        }
        return;
      }
    };
    root.addEventListener("click", root.__reviewsWidgetMediaClick);

    root.addEventListener("submit", (event) => {
      const form = event.target.closest('[data-role="submit-form"]');
      if (form && root.contains(form)) {
        event.preventDefault();
        submitReview(root, state, form);
        return;
      }
      const qaForm = event.target.closest('[data-role="qa-submit-form"]');
      if (qaForm && root.contains(qaForm)) {
        event.preventDefault();
        submitQuestion(root, state, qaForm);
      }
    });

    root.addEventListener("change", (event) => {
      const input = event.target.closest('[data-role="form-media"]');
      if (input && root.contains(input) && input.files && input.files.length) {
        state.formMedia = state.formMedia || [];
        const limit = state.config.form.maxMedia || 3;
        Array.from(input.files).forEach((file) => {
          if (state.formMedia.length >= limit) {
            state.formError = `Максимум ${limit} файлов`;
            return;
          }
          state.formMedia.push({ file, preview: file.type && file.type.indexOf("image/") === 0 ? URL.createObjectURL(file) : "./assets/review-video.svg" });
        });
        input.value = "";
        render(root, state);
      }
    });
    const feedEl = root.querySelector('[data-role="player-feed"]');
    if (feedEl) {
      feedEl.addEventListener("mouseenter", () => {
        state.feedPaused = true;
        clearFeedTimer(state);
      });
      feedEl.addEventListener("mouseleave", () => {
        state.feedPaused = false;
        scheduleFeedTimer(root, state);
      });
    }


    const loadMoreBtn = root.querySelector('[data-role="load-more"]');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => {
        if (state.loadingMore) {
          return;
        }
        if (state.fullFeedSource && state.visible >= state.reviews.length && !state.fullFeedExhausted) {
          loadMoreReviews(root, state);
          return;
        }
        state.visible += state.config.layout.pageSize;
        render(root, state);
      });
    }
  }

  function render(root, state) {
    root.classList.toggle("rw-is-expanded", state.expanded);

    // Tab visibility
    const tabReviewsEl = root.querySelector('[data-role="tab-reviews"]');
    const tabQuestionsEl = root.querySelector('[data-role="tab-questions"]');
    if (tabReviewsEl) tabReviewsEl.classList.toggle("is-active", state.activeTab === "reviews");
    if (tabQuestionsEl) tabQuestionsEl.classList.toggle("is-active", state.activeTab === "questions");
    // Макет не имеет вкладок: при выключенных вопросах строка вкладок скрывается,
    // а CTA живёт в шапке (rw-head). При включённых — вкладки возвращаются.
    const tabsRow = root.querySelector(".rw-tabs");
    if (tabsRow) tabsRow.hidden = !tabQuestionsEl;
    // Макет: без вкладки «Вопросы» весь блок шапки-вкладок схлопывается.
    const headerRow = root.querySelector(".rw-header");
    if (headerRow) headerRow.hidden = !tabQuestionsEl;

    // Header write CTA: product context only (T2).
    const writeCta = root.querySelector('[data-role="write-cta"]');
    if (writeCta) {
      writeCta.hidden = state.context !== "product" || state.activeTab !== "reviews";
    }
    // The overview, media strip and filter bar describe reviews only — hide them
    // on the questions tab so they don't imply the ratings/filters apply there.
    root.classList.toggle("rw-showing-questions", state.activeTab === "questions");

    const panelReviews = root.querySelector('[data-role="panel-reviews"]');
    const panelQuestions = root.querySelector('[data-role="panel-questions"]');
    if (panelReviews) panelReviews.hidden = state.activeTab !== "reviews";
    if (panelQuestions) panelQuestions.hidden = state.activeTab !== "questions";

    if (state.activeTab === "questions") {
      renderQuestionsPanel(root, state);
      return;
    }

    if (state.loading || state.error) {
      renderSummary(root, state.reviews, [], state);
      renderSegments(root, state, state.reviews);
      renderDistribution(root, state.reviews, state);
      renderPlayerFeed(root, state);
      renderMediaStrip(root, state, state.config);
      renderWall(root, state.reviews, state.config);
      renderList(root, [], state);
      renderStatus(root, state.loading ? "Загружаем отзывы" : state.error, true);
      root.querySelector('[data-role="load-more"]').hidden = true;
      renderSubmission(root, state);
      return;
    }

    const query = String(state.searchQuery || "").trim().toLowerCase();
    const all = chipsFilter(state.reviews, root);
    const filtered = sortReviews(
      all.filter((review) => {
        const ratingOk = ratingMatches(review.rating, state.rating);
        const mediaOk = mediaMatches(review, state.mediaFilter);
        const defaultsOk = matchesDefaults(review, state.config.defaults);
        const searchOk = !query
          || `${review.text || ""} ${review.pros || ""} ${review.cons || ""}`.toLowerCase().includes(query);
        return ratingOk && mediaOk && defaultsOk && searchOk;
      }),
      state.sort,
      state.config,
    );

    const pages = state.config.layout.pagination === "pages"
      ? Math.max(1, Math.ceil(filtered.length / state.config.layout.pageSize))
      : 0;
    if (pages && state.pagerPage >= pages) state.pagerPage = 0;
    const visibleCount = pages
      ? filtered.slice(state.pagerPage * state.config.layout.pageSize, (state.pagerPage + 1) * state.config.layout.pageSize).length
      : effectiveVisibleCount(state, filtered.length);

    renderSummary(root, all, filtered, state);
    renderSegments(root, state, all);
    renderDistribution(root, all, state);
    renderPlayerFeed(root, state);
    renderMediaStrip(root, state, state.config);
    renderWall(root, filtered, state.config);
    renderList(root, pages
      ? filtered.slice(state.pagerPage * state.config.layout.pageSize, (state.pagerPage + 1) * state.config.layout.pageSize)
      : filtered.slice(0, visibleCount), state);

    renderStatus(root, state.moreError || "Отзывов с такими фильтрами нет", filtered.length === 0 || Boolean(state.moreError));
    const loadMore = root.querySelector('[data-role="load-more"]');
    const pager = root.querySelector('[data-role="pager"]');
    if (pages) {
      renderPager(root, state, filtered.length, pages);
      if (loadMore) loadMore.hidden = true;
    } else if (pager) {
      pager.hidden = true;
      if (loadMore) {
        const canLoadRemote = Boolean(state.fullFeedSource && !state.fullFeedExhausted);
        loadMore.textContent = state.loadingMore ? "Загружаем" : "Показать ещё";
        loadMore.disabled = state.loadingMore;
        loadMore.hidden = visibleCount >= filtered.length && !canLoadRemote;
      }
    }
    renderSubmission(root, state);
  }

  function renderStatus(root, text, visible) {
    const status = root.querySelector('[data-role="status"]');
    if (!status) return;
    status.textContent = text;
    status.hidden = !visible;
  }
  /* ===== Плеер-лента (секция player) ===== */
  const FEED_AR = { "9:16": "9 / 16", "3:4": "3 / 4", "1:1": "1 / 1" };
  function renderPlayerFeed(root, state) {
    const el = root.querySelector('[data-role="player-feed"]');
    if (!el) return;
    const cfg = state.config.layout.player;
    const show = state.config.layout.sections.includes("player") && cfg.enabled !== false && state.context === "product";
    el.hidden = !show;
    if (!show) {
      clearFeedTimer(state);
      el.innerHTML = "";
      return;
    }
    // Источник ленты: макетная FEED (mount-опция feed) либо медиа отзывов.
    const feedItems = state.feed || state.reviews.flatMap((review) => review.media);
    if (!feedItems.length) {
      clearFeedTimer(state);
      el.innerHTML = "";
      return;
    }
    const proxyBase = root.__reviewsProxyBase || "";
    const tiles = feedItems.slice(0, 18).map((item, index) => {
      const author = item.authorName || "Покупатель";
      const src = item.previewUrl || "./assets/review-video.svg";
      const dur = item.duration ? `<span class="rw-tile-dur">${escapeHTML(item.duration)}</span>` : "";
      const badge = cfg.showSourceBadge && item.marketplace
        ? `<span class="rw-tile-badge">${escapeHTML({ wb: "WB", ozon: "Ozon", ym: "ЯМ" }[item.marketplace] || item.marketplace)}</span>` : "";
      const who = cfg.showAuthor
        ? `<span class="rw-tile-who"><span class="rw-tile-av">${escapeHTML(initials(author))}</span>${escapeHTML(author)}</span>` : "";
      const likes = cfg.showLikes && item.likes
        ? `<span class="rw-tile-like"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.9 13a4.6 4.6 0 0 1 0-6.4 4.3 4.3 0 0 1 6.2 0l.9 1 .9-1a4.3 4.3 0 0 1 6.2 0 4.6 4.6 0 0 1 0 6.4Z"/></svg>${escapeHTML(String(item.likes))}</span>` : "";
      const active = cfg.autoAdvance.enabled && index === state.feedIndex;
      const mediaAttrs = mediaTriggerAttributes({ ...item, previewUrl: item.previewUrl || "" }, `Видео отзыва, ${author}`, false);
      return `<button class="rw-feed-tile${active ? " is-playing" : ""}" ${mediaAttrs} aria-label="Смотреть видео · ${escapeAttribute(author)}">
        <img src="${escapeAttribute(src)}" alt="Кадр из видео покупательницы" loading="lazy" />
        <span class="rw-tile-grad" aria-hidden="true"></span>
        ${item.kind === "video" ? `<span class="rw-tile-play" aria-hidden="true"><i></i></span>${dur}` : ""}${badge}${who}${likes}
        ${active ? `<span class="rw-tile-prog" aria-hidden="true"><i></i></span><span class="rw-tile-ring" aria-hidden="true"></span>` : ""}
      </button>`;
    }).join("");
    // Макет fhead: «N видео · N фото» + «Смотреть все» справа.
    const vids = feedItems.filter((item) => item.kind === "video").length;
    const photos = feedItems.length - vids;
    const viewAll = cfg.showViewAll === false ? "" : `<button class="rw-feed-all" type="button">${escapeHTML(state.config.labels.viewAll || defaultConfig.labels.viewAll)}</button>`;
    el.innerHTML = `
      <div class="rw-feed-head">
        <b>${escapeHTML(cfg.title || defaultConfig.layout.player.title)}</b>
        <span class="rw-feed-n">${vids} видео · ${photos} фото</span>
        ${viewAll}
      </div>
      <div class="rw-feed-row">${tiles}</div>
    `;
    el.style.setProperty("--rw-feed-ar", FEED_AR[cfg.tile.aspect] || "9 / 16");
    el.style.setProperty("--rw-feed-tile", `${cfg.tile.width}px`);
    scheduleFeedTimer(root, state);
  }
  function clearFeedTimer(state) {
    if (state.feedTimer) { clearTimeout(state.feedTimer); state.feedTimer = null; }
  }
  function feedVideoIndexes(state) {
    const feedItems = state.feed || state.reviews.flatMap((review) => review.media);
    return feedItems.filter((item) => item.kind === "video");
  }
  function scheduleFeedTimer(root, state) {
    clearFeedTimer(state);
    const cfg = state.config.layout.player;
    if (!cfg.autoAdvance.enabled || state.feedPaused) return;
    const viewer = root.querySelector('[data-role="media-viewer"]');
    const videos = feedVideoIndexes(state);
    if (viewer && viewer.open) return;
    if (!videos.length) return;
    if (state.feedIndex < 0 || state.feedIndex >= videos.length) state.feedIndex = 0;
    state.feedTimer = setTimeout(() => {
      state.feedTimer = null;
      state.feedIndex = (state.feedIndex + 1) % videos.length;
      render(root, state);
    }, (cfg.autoAdvance.intervalSec || 5) * 1000);
  }

  /* ===== Пагинация «Страницы» ===== */
  function renderPager(root, state, total, pages) {
    const pager = root.querySelector('[data-role="pager"]');
    if (!pager) return;
    pager.hidden = pages <= 1;
    if (pages <= 1) { pager.innerHTML = ""; return; }
    let html = "";
    for (let i = 0; i < pages; i++) {
      html += `<button type="button" aria-current="${i === state.pagerPage}" data-page="${i}">${i + 1}</button>`;
    }
    pager.innerHTML = html;
  }

  /* ===== Медиа в карточке (раскладки макета) ===== */
  function renderMediaSet(media, config, proxyBase) {
    if (!config.visibility.photos || !media.length) {
      return "";
    }
    const mc = config.layout.mediacard;
    const lim = mc.layout === "one" ? 1 : Math.min(media.length, mc.maxTiles);
    const rest = media.length - lim;
    const tiles = media.slice(0, lim).map((raw, index) => {
      const item = absolutizeUserMedia(raw, proxyBase);
      const rawSrc = item.kind === "video" ? item.previewUrl || "./assets/review-video.svg" : item.url;
      const src = item.kind === "video" ? rawSrc : mediaProxyURL(rawSrc, proxyBase);
      const caption = item.kind === "video" ? "Видео отзыва" : "Фото отзыва";
      const last = index === lim - 1;
      const plus = last && rest > 0 && mc.plusMore ? `<span class="rw-mt-more">+${rest}</span>` : "";
      const dur = item.kind === "video" && item.duration ? `<span class="rw-mt-dur">${escapeHTML(item.duration)}</span>` : "";
      const play = item.kind === "video" ? `<span class="rw-mt-play" aria-hidden="true"><i></i></span>` : "";
      return `<button type="button" class="rw-mt" ${mediaTriggerAttributes(item, caption, false)}>
        <img src="${escapeAttribute(src)}" alt="${escapeAttribute(caption)}" loading="lazy">${play}${dur}${plus}
      </button>`;
    }).join("");
    return `<div class="rw-media-set rw-mc-${escapeAttribute(mc.layout)}">${tiles}</div>`;
  }

  function renderSummary(root, all, filtered, state) {
    const scoreEl = root.querySelector('[data-role="score"]');
    if (!scoreEl && !root.querySelector('[data-role="summary"]')) return;
    const aggregate = summaryAggregate(all, state);
    const total = aggregate.totalReviews;
    const average = aggregate.averageRating;
    if (scoreEl) scoreEl.textContent = formatScore(average);
    const stars = root.querySelector('[data-role="stars"]');
    const countEl = root.querySelector('[data-role="review-count"]');
    const summaryEl = root.querySelector('[data-role="summary"]');
    if (stars) {
      if (stars.closest(".rw-head")) {
        // Макет: глифы «★★★★★» с затемнённым остатком (w-stars .dim).
        const full = Math.round(average);
        stars.innerHTML = "★".repeat(full) + (full < 5 ? `<span class="rw-dim">${"★".repeat(5 - full)}</span>` : "");
      } else {
        stars.style.setProperty("--rating", average.toFixed(2));
      }
    }
    if (countEl) countEl.textContent = String(total);
    if (summaryEl) {
      // Макет w-count: «312 отзывов · 89% рекомендуют» (без «N показано»).
      let text = pluralize(total, "отзыв", "отзыва", "отзывов");
      if (state.config.header.elements.recommend !== false && Number.isFinite(aggregate.recommendPercent) && aggregate.recommendPercent > 0) {
        text += ` · ${Math.round(aggregate.recommendPercent)}% рекомендуют`;
      }
      summaryEl.textContent = text;
    }
  }
  // «4,7» — запятая, как в макете (ru-RU формат без следящего нуля).
  function formatScore(average) {
    return average.toFixed(1).replace(".", ",");
  }

  function reviewCustomValue(review, id) {
    const custom = review.custom || {};
    const value = custom[id];
    return typeof value === "string" ? value.trim() : value == null ? "" : String(value);
  }
  // Макет w-chips: один ряд пилюль «Все · С фото · 5★ · площадки · настраиваемые
  // поля». Мультиселект: клик добавляет/снимает чип, «Все» сбрасывает.
  function renderSegments(root, state, reviews) {
    const chipsRoot = root.querySelector('[data-role="chips"]');
    if (!state.config.visibility.filters || !chipsRoot) return;
    chipsRoot.innerHTML = "";
    const chipState = chipStates(root);
    const chip = (value, label, pressed, onClick) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rw-chip" + (pressed ? " on" : "");
      b.setAttribute("data-chip", value);
      b.setAttribute("aria-pressed", String(pressed));
      b.textContent = label;
      b.addEventListener("click", onClick);
      chipsRoot.appendChild(b);
    };
    const active = chipState.size === 0;
    chip("all", "Все", active, () => { chipState.clear(); resetListingState(state); render(root, state); });
    chip("photo", "С фото", chipState.has("photo"), () => { toggleChip(chipState, "photo"); resetListingState(state); render(root, state); });
    const ratingSource = reviews.filter((review) => matchesDefaults(review, state.config.defaults));
    if (ratingSource.some((review) => review.rating === 5)) {
      chip("star5", "5★", chipState.has("star5"), () => { toggleChip(chipState, "star5"); resetListingState(state); render(root, state); });
    }
    unique(reviews.map((review) => review.marketplace)).forEach((value) => {
      chip(value, labelMarketplaceValue(value, reviews), chipState.has(value), () => { toggleChip(chipState, value); resetListingState(state); render(root, state); });
    });
    // Макет renderChips: чипы настраиваемых полей — все опции фильтруемого
    // поля в порядке options (не только наблюдаемые значения).
    const fields = (state.config.customFields || []).filter((field) => field.filterable);
    fields.forEach((field) => {
      field.options.forEach((value) => {
        chip(`${field.id}:${value}`, `${field.label}: ${value}`, chipState.has(`${field.id}:${value}`),
          () => { toggleChip(chipState, `${field.id}:${value}`); resetListingState(state); render(root, state); });
      });
    });
  }
  function chipStates(root) {
    root.__chipState = root.__chipState || new Set();
    return root.__chipState;
  }
  function toggleChip(chipState, value) {
    if (chipState.has(value)) chipState.delete(value);
    else chipState.add(value);
  }
  function chipsFilter(reviews, root) {
    const chipState = chipStates(root);
    if (!chipState.size) return reviews;
    return reviews.filter((review) => {
      let ok = true;
      chipState.forEach((c) => {
        if (c === "photo") ok = ok && !!(review.photo || (review.media || []).length);
        else if (c === "star5") ok = ok && review.rating === 5;
        else if (c.includes(":")) {
          const idx = c.indexOf(":");
          const id = c.slice(0, idx), val = c.slice(idx + 1);
          ok = ok && String(reviewCustomValue(review, id)) === val;
        }
        else ok = ok && review.marketplace === c;
      });
      return ok;
    });
  }



  // Макет w-dist: подписи «5★…1★» и полосы-проценты (не counts); вход —
  // state.aggregate.distribution, при отсутствии — проценты из отзывов.
  function renderDistribution(root, reviews, state) {
    const distRoot = root.querySelector('[data-role="distwrap"]');
    if (!distRoot) return;
    const remote = state.aggregate && state.aggregate.totalReviews > 0 ? state.aggregate : null;
    let rows;
    if (remote && Array.isArray(remote.distribution) && remote.distribution.length) {
      rows = remote.distribution.map((d) => ({ rating: d.stars, percent: d.percent }));
    } else {
      const total = Math.max(1, reviews.length);
      rows = [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        percent: Math.round((countByRating(reviews, rating) / total) * 100),
      }));
    }
    distRoot.innerHTML = rows.map(({ rating, percent }) =>
      `<span class="rw-dl">${rating}★</span><span class="rw-db"><i style="width:${Math.min(100, Math.max(0, percent))}%"></i></span>`
    ).join("");
  }

  function renderMediaStrip(root, state, config) {
    const mediaRoot = root.querySelector('[data-role="media-strip"]');
    if (!mediaRoot) return;
    // Порядок ленты: макетная FEED первой (mount-опция), затем оставшиеся медиа
    // отзывов, не вошедшие в FEED — так совпадает порядок buildMedia() макета.
    const panel = productPanelState(root, config);
    let media = [];
    if (state.feed) {
      const mediaKey = (u) => String(u || "").replace(/^.*\//, "").replace(/-/g, "").toLowerCase();
      const feedUrls = new Set(state.feed.map((item) => mediaKey(item.url)));
      const rest = [];
      state.reviews.forEach((review) => review.media.forEach((raw) => {
        const item = {
          ...absolutizeUserMedia(raw, root.__reviewsProxyBase),
          authorName: review.authorName || "Покупатель",
          marketplace: review.marketplace || "",
          rating: review.rating,
        };
        if (!feedUrls.has(mediaKey(item.url))) rest.push(decorateItemForPanel(item, review, panel));
      }));
      media = [...state.feed, ...rest];
    } else {
      media = state.reviews.flatMap((review) => {
        return review.media.map((raw) => {
          const item = {
            ...absolutizeUserMedia(raw, root.__reviewsProxyBase),
            authorName: review.authorName || "Покупатель",
            marketplace: review.marketplace || "",
            rating: review.rating,
          };
          return decorateItemForPanel(item, review, panel);
        });
      });
    }
    // Макет (04-editor w-media): один ряд квадратов 96px, видео — play-иконка
    // снизу-справа (splay 20px) и длительность снизу-слева (sdur 9px). Без
    // заголовка «Фото покупателей» и без сплит-рельс: вся медиа одной лентой.
    const stileHTML = (item) => {
      const rawSrc = item.kind === "video" ? item.previewUrl || "./assets/review-video.svg" : item.url;
      const src = item.kind === "video" ? rawSrc : mediaProxyURL(rawSrc, root.__reviewsProxyBase);
      const caption = item.kind === "video" ? `Видео отзыва, ${item.authorName}` : `Фото отзыва, ${item.authorName}`;
      const play = item.kind === "video"
        ? `<span class="rw-splay"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg></span><span class="rw-sdur">${escapeHTML(item.duration || "")}</span>`
        : "";
      return `<button type="button" class="rw-stile" ${mediaTriggerAttributes(item, caption, Boolean(panel))}>
        <img src="${escapeAttribute(src)}" alt="${escapeAttribute(item.kind === "video" ? `Кадр из видео из отзыва · ${item.authorName}` : `Фото из отзыва · ${item.authorName}`)}" loading="lazy">${play}
      </button>`;
    };
    mediaRoot.hidden = media.length === 0;
    if (media.length === 0) {
      mediaRoot.innerHTML = "";
      return;
    }
    mediaRoot.innerHTML = media.slice(0, 9).map(stileHTML).join("");
  }

  function renderWall(root, reviews, config) {
    const wallRoot = root.querySelector('[data-role="wall"]');
    if (!wallRoot) return;
    wallRoot.hidden = true;
    if (config.layout.mode !== "wall" || !config.visibility.photos) {
      wallRoot.innerHTML = "";
      return;
    }
    const panel = productPanelState(root, config);
    const items = reviews.flatMap((review) => {
      return review.media.map((raw) => {
        const item = {
          ...absolutizeUserMedia(raw, root.__reviewsProxyBase),
          authorName: review.authorName || "Покупатель",
          marketplace: review.marketplace || "",
          rating: review.rating,
        };
        return decorateItemForPanel(item, review, panel);
      });
    });
    if (items.length === 0) {
      wallRoot.innerHTML = "";
      return;
    }
    const viewAllHref = config.appearance.viewAllHref;
    wallRoot.hidden = false;
    wallRoot.innerHTML = `
      <div class="rw-wall-head">
        <span class="rw-wall-label">Стиль от сообщества</span>
        <span class="rw-wall-count">${pluralize(items.length, "фото", "фото", "фото")}</span>
        ${viewAllHref ? `<a class="rw-view-all" href="${escapeAttribute(viewAllHref)}" target="_blank" rel="noreferrer">Смотреть все</a>` : ""}
        ${items
          .slice(0, config.layout.wall.maxTiles)
          .map((item) => {
            const rawSrc = item.kind === "video" ? item.previewUrl || "./assets/review-video.svg" : item.url;
            const src = item.kind === "video" ? rawSrc : mediaProxyURL(rawSrc, root.__reviewsProxyBase);
            const caption = item.kind === "video" ? `Видео отзыва, ${item.authorName}` : `Фото отзыва, ${item.authorName}`;
            const hoverMarkup = config.layout.tileHover !== false
              ? `<span class="rw-tile-hover"><span class="rw-stars" style="--rating: ${item.rating || 0}"></span><span>${escapeHTML(item.authorName || "Покупатель")}</span><span class="rw-tile-label">Смотреть</span></span>`
              : "";
            return `
              <a class="rw-wall-tile${item.kind === "video" ? " is-video" : ""}" href="${escapeAttribute(item.url)}" ${mediaTriggerAttributes(item, caption, Boolean(panel))}>
                <img src="${escapeAttribute(src)}" alt="${escapeAttribute(item.kind === "video" ? "Видео отзыва" : `Фото отзыва, ${item.authorName}`)}" loading="lazy" />
                ${item.kind === "video" ? '<span class="rw-play-badge"></span>' : ""}
                ${item.kind === "video" && config.layout.video.showSourceBadge && item.marketplace ? `<span class="rw-video-card-src">${escapeHTML(marketplaceLabels[item.marketplace] || item.marketplace)}</span>` : ""}
                ${hoverMarkup}
              </a>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderList(root, reviews, state) {
    const list = root.querySelector('[data-role="list"]');
    if (!list) return;
    list.innerHTML = "";
    reviews.forEach((review) => {
      const card = document.createElement("article");
      card.className = "rw-card";
      const marketplaceLink = review.marketplaceReviewUrl || review.marketplaceProductUrl;
      if (marketplaceLink) {
        card.classList.add("is-clickable");
        card.dataset.href = marketplaceLink;
        card.tabIndex = 0;
        card.setAttribute("aria-label", "Открыть источник отзыва");
      }

  // Макет: звёзды-глифы «★★★★★» с затемнённым остатком (w-stars .dim).
  function starRowHTML(rating) {
    const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return "★".repeat(n) + (n < 5 ? `<span class="rw-dim">${"★".repeat(5 - n)}</span>` : "");
  }
  // Макет w-when: относительные даты «сегодня / вчера / N дн назад», иначе Intl.
  function relativeDate(date) {
    const value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) return formatDate(date);
    const days = Math.floor((Date.now() - value.getTime()) / 86400000);
    if (days <= 0) return "сегодня";
    if (days === 1) return "вчера";
    return formatDate(value);
  }
  // Макет w-badge: короткий бейдж площадки («WB», «Ozon», «ЯМ») или «Новый».
  function marketBadge(review) {
    const pinned = review.pinned;
    if (pinned) return `<span class="rw-badge">Новый</span>`;
    const label = { wb: "WB", ozon: "Ozon", ym: "ЯМ" }[review.marketplace];
    if (!label) return "";
    return `<span class="rw-badge">${escapeHTML(label)}</span>`;
  }
      card.innerHTML = `
        ${renderMediaSet(review.media, root.__reviewsWidgetConfig, root.__reviewsProxyBase)}
        <div class="rw-cbody">
          <div class="rw-chiprow"><span class="rw-av">${escapeHTML(initials(review.authorName || "Покупатель"))}</span><span><span class="rw-name">${escapeHTML(review.authorName || "Покупатель")}</span> <span class="rw-when">· ${relativeDate(review.createdAt)}</span></span></div>
          <div class="rw-stars rw-card-stars" style="margin-top:6px">${starRowHTML(review.rating)}</div>
          ${review.title ? `<div class="rw-card-title">${escapeHTML(review.title)}</div>` : ""}
          ${renderCardText(review, state, root.__reviewsWidgetConfig)}
          ${renderCustomTags(review, root.__reviewsWidgetConfig)}
          ${renderProsCons(review, root.__reviewsWidgetConfig)}
          ${renderAnswer(review.answer, root.__reviewsWidgetConfig)}
          <div class="rw-badges">${marketBadge(review)}<span class="rw-badge n">Проверенная покупка</span></div>
        </div>
      `;
      if (marketplaceLink) {
        card.addEventListener("click", (event) => {
          if (event.target.closest("a, button, select")) {
            return;
          }
          window.open(marketplaceLink, "_blank", "noreferrer");
        });
        card.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") {
            return;
          }
          window.open(marketplaceLink, "_blank", "noreferrer");
        });
      }
      list.appendChild(card);
    });
  }

  function renderCustomTags(review, config) {
    const fields = (config && config.customFields) || [];
    const tagsCfg = (config && config.customTags) || defaultConfig.customTags;
    const tags = fields
      .filter((field) => field.showInReview !== false)
      .map((field) => {
        const value = reviewCustomValue(review, field.id);
        return value ? { label: field.label, value } : null;
      })
      .filter(Boolean);
    if (!tags.length) return "";
    if (tagsCfg.display === "string") {
      return `<div class="rw-custom-tags rw-custom-tags-string">${tags.map((tag) =>
        `<span class="rw-custom-tag">${escapeHTML(tag.label)} <b>${escapeHTML(tag.value)}</b></span>`
      ).join('<span class="rw-tag-sep">·</span>')}</div>`;
    }
    // Макет w-attrs: пилюли «Рост 164» (label+value внутри одной пилюли).
    return `<div class="rw-attrs">${tags.map((tag) =>
      `<span class="rw-attr">${tagsCfg.chipLabel === false ? "" : escapeHTML(tag.label) + " "}${escapeHTML(tag.value)}</span>`
    ).join("")}</div>`;
  }

  // "Читать полностью": clamp long review texts to 6 lines behind a toggle.
  function renderCardText(review, state, config) {
    const text = String(review.text || "");
    if (!text) {
      return "";
    }
    const key = reviewKey(review);
    const expanded = state.expandedTexts.has(key);
    const clampable = text.length > 280;
    const label = (config && config.labels && config.labels.readMore) || "Читать полностью";
    const clampClass = clampable && !expanded ? " rw-clamped" : "";
    const toggle = clampable
      ? `<button class="rw-read-more" type="button" data-role="read-more" data-review-key="${escapeAttribute(key)}" aria-expanded="${expanded ? "true" : "false"}">${escapeHTML(label)}</button>`
      : "";
    return `<p class="rw-card-text${clampClass}">${escapeHTML(text)}</p>${toggle}`;
  }

  function renderMeta(review, config) {
    const sellerArticle = review.sellerArticle || "не сопоставлен";
    const marketplaceArticle = review.externalProductId || "без артикула";
    const sellerProduct = review.sellerProductUrl && review.sellerArticle
      ? `<a class="rw-article-link" href="${escapeAttribute(review.sellerProductUrl)}" target="_blank" rel="noreferrer">${escapeHTML(sellerArticle)}</a>`
      : `<span>${escapeHTML(sellerArticle)}</span>`;
    const marketplaceProduct = review.marketplaceProductUrl
      ? `<a class="rw-article-link" href="${escapeAttribute(review.marketplaceProductUrl)}" target="_blank" rel="noreferrer">${escapeHTML(marketplaceArticle)}</a>`
      : `<span>${escapeHTML(marketplaceArticle)}</span>`;
    const marketplaceLink = review.marketplaceReviewUrl || review.marketplaceProductUrl;
    const marketplaceAction = marketplaceLink
      ? `<a class="rw-open-market" href="${escapeAttribute(marketplaceLink)}" target="_blank" rel="noreferrer">Открыть источник отзыва</a>`
      : "";
    const sellerAction = review.sellerProductUrl
      ? `<a class="rw-open-store" href="${escapeAttribute(review.sellerProductUrl)}" target="_blank" rel="noreferrer">Посмотреть товар в магазине</a>`
      : "";
    const actions = marketplaceAction || sellerAction
      ? `<span class="rw-actions">${marketplaceAction}${sellerAction}</span>`
      : "";

    return `
      <div class="rw-meta-row">
        <span class="rw-article"><span class="rw-meta-label">Артикул</span> ${sellerProduct}</span>
        <span class="rw-article"><span class="rw-meta-label">На площадке</span> ${marketplaceProduct}</span>
        ${actions}
      </div>
    `;
  }

  function decorateItemForPanel(item, review, panel) {
    if (!panel) {
      return item;
    }
    const firstPhoto = (review.media || []).find((media) => (media.kind || "photo") !== "video");
    const product = review.product || null;
    return {
      ...item,
      productUrl: review.sellerProductUrl || review.marketplaceProductUrl || "",
      productImage: firstPhoto ? mediaProxyURL(firstPhoto.url, panel.proxyBase) : "",
      productRating: review.rating,
      productPrice: product && product.price ? product.price : "",
      productName: product && product.name ? product.name : "",
      reviewText: review.text || "",
      reviewAttrs: [],
      review,
    };
  }

  // Макет w-pros: muted-строка «Плюсы: …» (без бокса).
  function renderProsCons(review, config) {
    if (!config.visibility.prosCons) {
      return "";
    }
    const items = [];
    if (review.pros) {
      items.push(`<p class="rw-pros">${escapeHTML(review.pros)}</p>`);
    }
    if (review.cons) {
      items.push(`<p class="rw-pros">${escapeHTML(review.cons)}</p>`);
    }
    return items.length ? `<div class="rw-pros-cons">${items.join("")}</div>` : "";
  }


  function productPanelState(root, config) {
    if (!config.layout.video.productPanel || root.classList.contains("rw-context-homepage")) {
      return null;
    }
    return {
      proxyBase: root.__reviewsProxyBase || "",
    };
  }

  function decorateItemForPanel(item, review, panel) {
    if (!panel) {
      return item;
    }
    const firstPhoto = (review.media || []).find((media) => (media.kind || "photo") !== "video");
    return {
      ...item,
      productUrl: review.sellerProductUrl || review.marketplaceProductUrl || "",
      productImage: firstPhoto ? mediaProxyURL(firstPhoto.url, panel.proxyBase) : "",
      productRating: review.rating,
      productPrice: review.productPrice || "",
      reviewText: review.text || "",
      reviewAttrs: [],
      review,
    };
  }

  function mediaTriggerAttributes(item, caption, productPanel) {
    const key = `${item.kind || "media"}:${item.url || ""}`;
    return [
      'data-media-viewer="true"',
      `data-media-key="${escapeAttribute(key)}"`,
      `data-media-kind="${escapeAttribute(item.kind || "photo")}"`,
      `data-media-url="${escapeAttribute(item.url || "")}"`,
      `data-media-preview="${escapeAttribute(item.previewUrl || "")}"`,
      item.embedProvider ? `data-media-embed-provider="${escapeAttribute(item.embedProvider)}"` : "",
      item.embedId ? `data-media-embed-id="${escapeAttribute(item.embedId)}"` : "",
      `data-media-caption="${escapeAttribute(caption || "")}"`,
      productPanel ? [
        `data-media-product-url="${escapeAttribute(item.productUrl || "")}"`,
        `data-media-product-image="${escapeAttribute(item.productImage || "")}"`,
        `data-media-product-rating="${escapeAttribute(item.productRating != null ? String(item.productRating) : "")}"`,
        `data-media-product-price="${escapeAttribute(item.productPrice || "")}"`,
        `data-media-review-text="${escapeAttribute(item.reviewText || "")}"`,
        `data-media-author="${escapeAttribute((item.review || {}).authorName || "")}"`,
        `data-media-when="${escapeAttribute(item.review && item.review.createdAt ? formatDate(item.review.createdAt) : "")}"`,
        `data-media-stars="${escapeAttribute(String((item.review || {}).rating || 0))}"`,
      ] : [],
      'target="_blank"',
      'rel="noreferrer"',
    ].flat().filter(Boolean).join(" ");
  }

  function openMediaViewer(root, trigger, state) {
    const viewer = root.querySelector('[data-role="media-viewer"]');
    if (!viewer) {
      return;
    }
    const items = collectRenderedMedia(root);
    if (items.length === 0) {
      return;
    }
    const key = trigger.getAttribute("data-media-key");
    const index = Math.max(0, items.findIndex((item) => item.key === key));
    // Панель товара живёт на тайле-триггере: при дедупе ключей (feed + strip
    // рендерят одно медиа) переносим панельные атрибуты с кликнутого тайла.
    [["product-url", "productUrl"], ["product-image", "productImage"], ["product-rating", "productRating"],
     ["product-price", "productPrice"], ["review-text", "reviewText"]].forEach(([attr, prop]) => {
      const value = trigger.getAttribute("data-media-" + attr);
      if (value) items[index][prop] = value;
    });
    viewer.__items = items;
    viewer.__index = index;
    viewer.__previousFocus = root.ownerDocument.activeElement;
    if (state) state.viewerPlaying = true;
    viewer.showModal();
    renderMediaViewer(root, state);
    scheduleViewerTimer(root, state);
  }

  function closeMediaViewer(root, state) {
    const viewer = root.querySelector('[data-role="media-viewer"]');
    if (!viewer || !viewer.open) {
      return;
    }
    clearViewerTimer(root, state);
    viewer.close();
    if (state) state.viewerPlaying = false;
    const previousFocus = viewer.__previousFocus;
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
  }

  function shiftMediaViewer(root, direction, state) {
    const viewer = root.querySelector('[data-role="media-viewer"]');
    if (!viewer || !viewer.open || !viewer.__items || viewer.__items.length === 0) {
      return;
    }
    viewer.__index = (viewer.__index + direction + viewer.__items.length) % viewer.__items.length;
    if (state) state.viewerPlaying = true;
    renderMediaViewer(root, state);
    scheduleViewerTimer(root, state);
  }

  function toggleViewerPlay(root, state) {
    const viewer = root.querySelector('[data-role="media-viewer"]');
    if (!viewer || !viewer.open) return;
    state.viewerPlaying = !state.viewerPlaying;
    renderMediaViewer(root, state);
    scheduleViewerTimer(root, state);
  }

  function clearViewerTimer(root, state) {
    if (state && state.viewerTimer) { clearTimeout(state.viewerTimer); state.viewerTimer = null; }
    const prog = root.querySelector('[data-role="viewer-progress"]');
    if (prog) prog.hidden = true;
  }

  function scheduleViewerTimer(root, state) {
    if (!state) return;
    clearViewerTimer(root, state);
    const viewer = root.querySelector('[data-role="media-viewer"]');
    if (!viewer || !viewer.open) return;
    const cfg = state.config.layout.player.autoAdvance;
    if (!cfg.enabled || !state.viewerPlaying) return;
    const items = viewer.__items || [];
    const item = items[viewer.__index];
    if (!item || item.kind !== "video") return;
    const dur = durationSeconds(item.duration) || cfg.intervalSec || 5;
    const prog = root.querySelector('[data-role="viewer-progress"]');
    if (prog) {
      prog.hidden = false;
      prog.style.setProperty("--rw-vdur", `${dur}s`);
      prog.querySelectorAll("i").forEach((bar) => { const fresh = bar.cloneNode(); bar.replaceWith(fresh); });
    }
    state.viewerTimer = setTimeout(() => {
      state.viewerTimer = null;
      shiftMediaViewer(root, 1, state);
    }, dur * 1000);
  }
  function durationSeconds(text) {
    const match = String(text || "").match(/(\d+):(\d+)/);
    if (!match) return 0;
    return Math.min(90, (Number(match[1]) * 60 + Number(match[2])) || 0);
  }

  function renderMediaViewer(root, state) {
    const viewer = root.querySelector('[data-role="media-viewer"]');
    const items = viewer.__items || [];
    const item = items[viewer.__index];
    if (!item) {
      closeMediaViewer(root, state);
      return;
    }
    const stage = viewer.querySelector('[data-role="viewer-stage"]');
    const original = viewer.querySelector('[data-role="viewer-original"]');
    const counter = viewer.querySelector('[data-role="viewer-count"]');
    const prev = viewer.querySelector('[data-role="viewer-prev"]');
    const next = viewer.querySelector('[data-role="viewer-next"]');
    const queue = viewer.querySelector('[data-role="viewer-queue"]');
    const avatar = viewer.querySelector('[data-role="viewer-avatar"]');
    const nameEl = viewer.querySelector('[data-role="viewer-name"]');
    const whenEl = viewer.querySelector('[data-role="viewer-when"]');
    const starsEl = viewer.querySelector('[data-role="viewer-stars"]');
    const playBtn = viewer.querySelector('[data-role="viewer-play"]');
    const progress = viewer.querySelector('[data-role="viewer-progress"]');
    const cfg = root.__reviewsWidgetConfig || {};
    const canPlayVideo = item.kind === "video" && isLikelyVideoURL(item.url);
    const canShowImage = item.kind !== "video" || item.previewUrl || isLikelyImageURL(item.url);
    const rawViewerSrc = item.kind === "video" ? item.previewUrl || item.url : item.url || item.previewUrl;
    const viewerSrc = item.kind === "video" ? rawViewerSrc : mediaProxyURL(rawViewerSrc, root.__reviewsProxyBase);
    const captionText = item.caption || (item.kind === "video" ? "Видео отзыва" : "Фото отзыва");
    const review = item.review || {};
    if (nameEl) nameEl.textContent = review.authorName || "Покупатель";
    if (whenEl) whenEl.textContent = review.createdAt ? ` · ${formatDate(review.createdAt)}` : "";
    if (starsEl) starsEl.style.setProperty("--rating", String(review.rating || 0));
    if (original) {
      original.href = item.url;
      original.textContent = item.kind === "video" ? "Открыть видео" : "Открыть оригинал";
    }
    if (counter) counter.textContent = `${viewer.__index + 1} / ${items.length}`;
    if (prev) prev.hidden = items.length < 2;
    if (next) next.hidden = items.length < 2;
    const autoPlay = cfg.layout && cfg.layout.video && cfg.layout.video.autoplayInViewer !== false;
    if (playBtn) {
      playBtn.hidden = !canPlayVideo;
      playBtn.setAttribute("aria-label", state && state.viewerPlaying ? "Пауза" : "Воспроизвести");
      playBtn.classList.toggle("is-paused", !(state && state.viewerPlaying));
    }
    if (progress) progress.hidden = !(canPlayVideo && cfg.layout && cfg.layout.player.autoAdvance.enabled && state && state.viewerPlaying);
    const viewerVideoAttrs = autoPlay ? " autoplay muted" : "";
    const panel = renderProductPanel(item);
    const embedSrc = embedFrameURL(item);
    stage.innerHTML = panel
      ? `<div class="rw-media-viewer-with-panel">${panel.mediaHTML}${panel.html}</div>`
      : embedSrc
      ? `<iframe class="rw-media-viewer-embed" src="${escapeAttribute(embedSrc)}" title="${escapeAttribute(captionText)}" loading="lazy" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`
      : canPlayVideo
      ? `<video class="rw-media-viewer-video" src="${escapeAttribute(item.url)}" playsinline${viewerVideoAttrs}></video>`
      : canShowImage ? `
        <img class="rw-media-viewer-image" src="${escapeAttribute(viewerSrc)}" alt="${escapeAttribute(captionText)}" />
      `
        : `<a class="rw-media-viewer-placeholder" href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">Открыть медиа</a>`;
    if (queue) {
      queue.innerHTML = items.map((q, qi) => `
        <button type="button" class="rw-media-q" data-queue-index="${qi}" aria-current="${qi === viewer.__index}" aria-label="${escapeAttribute(q.kind === "video" ? "Видео" : "Фото")} · ${escapeAttribute((q.review || {}).authorName || "Покупатель")}">
          <img src="${escapeAttribute(q.kind === "video" ? (q.previewUrl || q.url) : q.url)}" alt="" loading="lazy" />
          ${q.kind === "video" ? '<span class="rw-media-q-play" aria-hidden="true"></span>' : ""}
        </button>`).join("");
    }
  }

  function renderProductPanel(item) {
    if (!item || !item.productUrl) {
      return null;
    }
    const rating = Number(item.productRating || 0);
    const image = item.productImage
      ? `<img src="${escapeAttribute(item.productImage)}" alt="" loading="lazy" />`
      : '<span class="rw-product-panel-media-empty" aria-hidden="true"></span>';
    const productName = item.productName
      ? `<b class="rw-product-panel-name">${escapeHTML(String(item.productName))}</b>` : "";
    const price = item.productPrice
      ? `<span class="rw-product-panel-price">${escapeHTML(String(item.productPrice))}</span>` : "";
    const reviewText = String(item.reviewText || "");
    const quote = reviewText
      ? `<p class="rw-product-panel-from">Из отзыва: <b>«${escapeHTML(reviewText.slice(0, 96))}${reviewText.length > 96 ? "…" : ""}»</b></p>` : "";
    const reviewAttrs = Array.isArray(item.reviewAttrs) ? item.reviewAttrs : [];
    const attrs = reviewAttrs.length
      ? `<div class="rw-product-panel-attrs">${reviewAttrs.map((chip) => `<span class="rw-attr">${escapeHTML(String(chip))}</span>`).join("")}</div>` : "";
    const html = `
      <aside class="rw-product-panel" aria-label="Товар из отзыва">
        <div class="rw-product-panel-media">${image}</div>
        ${productName}
        <div class="rw-product-panel-stars" style="--rating: ${Number.isFinite(rating) ? rating : 0}" aria-label="Рейтинг отзыва"></div>
        ${price}
        <a class="rw-product-panel-link" href="${escapeAttribute(item.productUrl)}" target="_blank" rel="noreferrer">Посмотреть товар</a>
        ${quote}
        ${attrs}
      </aside>
    `;
    const mediaHTML = embedFrameURL(item)
      ? `<div class="rw-product-panel-stage"><iframe class="rw-media-viewer-embed" src="${escapeAttribute(embedFrameURL(item))}" title="${escapeAttribute(item.caption || "")}" loading="lazy" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`
      : item.kind === "video" && isLikelyVideoURL(item.url)
      ? `<div class="rw-product-panel-stage"><video class="rw-media-viewer-video" src="${escapeAttribute(item.url)}" playsinline autoplay muted></video></div>`
      : `<div class="rw-product-panel-stage"><img class="rw-media-viewer-image" src="${escapeAttribute(item.previewUrl || item.url || item.productImage)}" alt="${escapeAttribute(item.caption || "")}" /></div>`;
    return { html, mediaHTML };
  }

  function collectRenderedMedia(root) {
    const seen = new Set();
    return Array.from(root.querySelectorAll("[data-media-viewer]"))
      .map((node) => ({
        key: node.getAttribute("data-media-key") || node.getAttribute("data-media-url") || node.href,
        kind: node.getAttribute("data-media-kind") || "photo",
        url: node.getAttribute("data-media-url") || node.href,
        previewUrl: node.getAttribute("data-media-preview") || "",
        caption: node.getAttribute("data-media-caption") || "",
        embedProvider: node.getAttribute("data-media-embed-provider") || "",
        embedId: node.getAttribute("data-media-embed-id") || "",
        productUrl: node.getAttribute("data-media-product-url") || "",
        productImage: node.getAttribute("data-media-product-image") || "",
        productRating: node.getAttribute("data-media-product-rating") || "",
        productPrice: node.getAttribute("data-media-product-price") || "",
        reviewText: node.getAttribute("data-media-review-text") || "",
        review: {
          authorName: node.getAttribute("data-media-author") || "",
          createdAt: node.getAttribute("data-media-when") || "",
          rating: Number(node.getAttribute("data-media-stars") || 0),
        },
      }))
      .filter((item) => {
        if (!item.url || seen.has(item.key)) {
          return false;
        }
        seen.add(item.key);
        return true;
      });
  }

  function isLikelyVideoURL(url) {
    return /\.(mp4|webm|ogg|ogv|m3u8)(\?|#|$)/i.test(String(url || ""));
  }

  function isLikelyImageURL(url) {
    return /\.(avif|gif|jpe?g|png|svg|webp)(\?|#|$)/i.test(String(url || ""));
  }

  // Social embeds: the iframe src is rebuilt from provider + EmbedID (never
  // from item.url), https-only, against this fixed allowlist. Empty embed
  // fields keep the existing photo/video rendering untouched.
  const embedAllowlist = [
    "https://vk.com/video",
    "https://www.youtube.com/embed/",
    "https://www.youtube-nocookie.com/embed/",
  ];

  function embedFrameURL(item) {
    if (!item || !item.embedProvider || !item.embedId) {
      return "";
    }
    const id = String(item.embedId);
    let src = "";
    if (item.embedProvider === "vk") {
      const parts = /^(-?\d+)_(\d+)$/.exec(id);
      if (parts) {
        src = `https://vk.com/video_ext.php?oid=${parts[1]}&id=${parts[2]}`;
      }
    } else if (item.embedProvider === "youtube" && /^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      src = `https://www.youtube.com/embed/${id}`;
    } else if (item.embedProvider === "youtube-nocookie" && /^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      src = `https://www.youtube-nocookie.com/embed/${id}`;
    }
    return src && embedAllowlist.some((prefix) => src.startsWith(prefix)) ? src : "";
  }

  function renderAnswer(answer, config) {
    if (!config.visibility.sellerAnswers || !answer || !answer.text) {
      return "";
    }
    const answers = config.answers || defaultConfig.answers;
    const fallbackTitle = answer.kind === "seller" ? "Ответ продавца" : "Ответ магазина";
    const title = String(answers.title || "").trim() || fallbackTitle;
    const showTitle = answers.showTitle !== false;
    // Макет w-ans (ans-card): «<b>Ответ продавца:</b> текст» в одной плашке.
    return `
      <div class="rw-answer" data-answer-kind="${escapeHTML(answer.kind || "")}" data-ans-style="${escapeHTML(answers.style)}"><b>${escapeHTML(title)}:</b> ${escapeHTML(answer.text)}</div>
    `;
  }

  // ── Custom form fields (товарные атрибуты: рост/вес/посадка) ──────────

  // Clamp an admin-configured customFields list the same way normalizeConfig
  // clamps its knobs: hard limits, type whitelist, option cleanup.
  function normalizeCustomFields(raw) {
    const fields = Array.isArray(raw) ? raw.slice(0, 6) : [];
    const out = [];
    const seen = {};
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i] || {};
      const id = String(field.id || "").trim();
      const label = String(field.label || "").trim();
      const type = field.type === "select" || field.type === "chips" || field.type === "text" ? field.type : "";
      if (!id || !label || !type || seen[id]) continue;
      seen[id] = true;
      const options = (Array.isArray(field.options) ? field.options : [])
        .map((option) => String(option || "").trim())
        .filter(Boolean)
        .slice(0, 12);
      out.push({
        id: id,
        label: label,
        type: type,
        options: options,
        required: field.required === true,
        filterable: field.filterable === true,
        showInReview: field.showInReview !== false,
        showInSummary: field.showInSummary === true,
      });
    }
    return out.filter((field) => field.type === "text" || field.options.length >= 2);
  }

  // One field: chip group (buttons + aria-pressed) for ≤5 options, otherwise a
  // native select; "text" falls back to a plain input. Mirrors the reference
  // competitor forms (question label, wrapped pills, single choice).
  // Макет attrFieldHTML: <div><span class=flabel>Рост</span><chips|select|input></div>.
  function renderCustomField(field) {
    const req = field.required ? ' <span class="rw-custom-required">*</span>' : "";
    const head = `<span class="rw-flabel">${escapeHTML(field.label)}${req}</span>`;
    if (field.type === "select") {
      return `<div class="rw-custom-field">${head}<select class="rw-input-w" name="custom-${escapeAttribute(field.id)}"><option value="">Не указан</option>${field.options.map((o) => `<option value="${escapeAttribute(o)}">${escapeHTML(o)}</option>`).join("")}</select></div>`;
    }
    if (field.type === "text") {
      return `<div class="rw-custom-field">${head}<input class="rw-input-w" name="custom-${escapeAttribute(field.id)}" maxlength="60" placeholder="Ваш ответ"></div>`;
    }
    return `<fieldset class="rw-custom-field rw-custom-chips" data-custom-chips="${escapeAttribute(field.id)}"><legend>${escapeHTML(field.label)}${req}</legend><div class="rw-chip-row">${field.options.map((o) => `<button type="button" class="rw-fchip rw-chip" data-custom-field="${escapeAttribute(field.id)}" data-custom-value="${escapeAttribute(o)}" aria-pressed="false">${escapeHTML(o)}</button>`).join("")}</div><input type="hidden" name="custom-${escapeAttribute(field.id)}" value="" /></fieldset>`;
  }

  function renderCustomFields(fields) {
    if (!fields.length) return "";
    return fields.map(renderCustomField).join("");
  }

  function formBodyHTML(root, state) {
    const cfg = state.submission.config;
    const accepts = (cfg.allowedTypes || []).join(",");
    const consentText = "Согласие на обработку персональных данных";
    const consentLabel = String(cfg.consentLabel || "Согласен(на) на публикацию отзыва");
    const consent = cfg.privacyUrl
      ? `<a href="${escapeAttribute(cfg.privacyUrl)}" target="_blank" rel="noreferrer">${consentLabel}</a>`
      : consentLabel;
    const customFields = normalizeCustomFields(cfg.customFields || []);
    const formCfg = state.config.form;
    const fields = formCfg.fields || defaultConfig.form.fields;
    const rating = Number(state.formRating || 0);
    const stars = [1, 2, 3, 4, 5].map((n) => `
      <button type="button" class="rw-form-star${n <= rating ? " is-on" : ""}" data-role="form-star" data-star="${n}" aria-label="${n} из 5" aria-pressed="${n <= rating}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.36L12 17.4l-5.7 3-1.09-6.37-4.62-4.49 6.38-.93L12 2.8z"/></svg>
      </button>`).join("");
    const thumbs = (state.formMedia || []).map((file, idx) => `
      <span class="rw-form-thumb"><img src="${escapeAttribute(file.preview)}" alt="" /><button type="button" data-role="form-thumb-remove" data-thumb-index="${idx}" aria-label="Убрать файл">×</button></span>
    `).join("");
    // Иннерная сетка дословно из макета (w-fmodal → formBodyHTML): заголовок
    // с hint, «Оценка» с inline-лейблом, Имя label+input одной строкой,
    // настраиваемые поля, Отзыв, медиа с подписью, согласие, кнопка.
    return `
      <form class="rw-submit-form" data-role="submit-form">
        <input type="text" name="website" class="rw-hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <input type="hidden" name="openedAt" value="${state.submission.openedAt}" />
        <input type="hidden" name="sellerArticle" value="${escapeAttribute(state.sellerArticle)}" />
        <div><b>${escapeHTML(formCfg.title || defaultConfig.form.title)}</b><p class="rw-hintform">Оценка и текст — обязательные поля. Значения настраиваемых полей подсвечиваются в отзыве.</p></div>
        <div><span class="rw-flabel">Оценка</span><div class="rw-form-stars" role="radiogroup" aria-label="Оценка">${stars}</div></div>
        <div class="rw-frow2"><span class="rw-flabel">Имя</span><input class="rw-input-w" name="authorName" required maxlength="80" autocomplete="name" placeholder="Как вас зовут"></div>
        ${fields.title ? `<div class="rw-frow2"><span class="rw-flabel">Заголовок</span><input class="rw-input-w" name="title" maxlength="512" placeholder="Коротко о главном" data-role="form-title"></div>` : ""}
        ${fields.email ? `<div class="rw-frow2"><span class="rw-flabel">Email — не публикуется</span><input class="rw-input-w" name="authorEmail" type="email" required maxlength="320" autocomplete="email" placeholder="name@mail.ru"></div>` : ""}
        ${renderCustomFields(customFields)}
        <div><span class="rw-flabel">Отзыв</span><textarea class="rw-input-w" name="text" required maxlength="3000" placeholder="Расскажите о покупке…">${""}</textarea></div>
        ${fields.media ? `<div><span class="rw-flabel">${escapeHTML(formCfg.mediaHint || "Фото или видео")}</span><div class="rw-form-upload"><label class="rw-form-add"><input name="media" type="file" accept="${escapeAttribute(accepts)}" multiple data-role="form-media" hidden>Добавить</label><button type="button" class="rw-form-add" data-role="form-add-media" hidden tabindex="-1" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.6-2.4A1 1 0 0 1 9.4 5h5.2a1 1 0 0 1 .8.6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.4"/></svg>Добавить</button><span class="rw-form-thumbs">${thumbs}</span></div></div>` : ""}
        <label class="rw-consent"><input name="privacyConsent" type="checkbox" required> <span>${consent}</span></label>
        ${state.formError ? `<span class="rw-ferr" data-role="form-error">${escapeHTML(state.formError)}</span>` : `<span class="rw-ferr" data-role="form-error" hidden></span>`}
        <button class="rw-submit-send" type="submit" ${state.submission.sending ? "disabled" : ""}>${state.submission.sending ? "Отправляем" : escapeHTML(state.config.form.submitLabel || defaultConfig.form.submitLabel)}</button>
      </form>
    `;
  }

  function successHTML() {
    return `
      <div class="rw-form-done">
        <span class="rw-form-done-ok" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <b>Спасибо! Отзыв отправлен</b>
        <p>Он появится в списке после модерации.</p>
        <span class="rw-form-done-actions">
          <button type="button" class="rw-submit-send" data-role="form-done">Готово</button>
          <button type="button" class="rw-form-again" data-role="form-again">Заполнить ещё раз</button>
        </span>
      </div>
    `;
  }

  function openFormModal(root, state) {
    const modal = root.querySelector('[data-role="form-modal"]');
    if (!modal || typeof modal.showModal !== "function") return;
    state.formModalOpen = true;
    state.formDone = false;
    state.formRating = 0;
    state.formMedia = [];
    state.formError = "";
    renderFormModal(root, state);
    if (modal.open) return;
    modal.__previousFocus = root.ownerDocument.activeElement;
    modal.showModal();
    const close = modal.querySelector('[data-role="form-modal-close"]');
    if (close) close.focus();
  }

  function closeFormModal(root, state) {
    const modal = root.querySelector('[data-role="form-modal"]');
    if (!modal || !modal.open) return;
    modal.close();
    state.formModalOpen = false;
    state.formDone = false;
    const previousFocus = modal.__previousFocus;
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
    modal.__previousFocus = null;
  }

  function renderFormModal(root, state) {
    const modal = root.querySelector('[data-role="form-modal"]');
    if (!modal) return;
    const titleEl = modal.querySelector('[data-role="form-modal-title"]');
    if (titleEl) titleEl.textContent = state.config.form.title || defaultConfig.form.title;
    const body = modal.querySelector('[data-role="form-modal-body"]');
    if (!body) return;
    body.innerHTML = state.formDone ? successHTML() : formBodyHTML(root, state);
  }

  function renderSubmission(root, state) {
    const submitRoot = root.querySelector('[data-role="submit"]');
    if (!submitRoot) return;
    const cfg = state.submission.config;
    if (state.context !== "product" || state.submission.loading || !cfg || cfg.enabled === false || !state.submissionUrl) {
      submitRoot.hidden = true;
      submitRoot.innerHTML = "";
      return;
    }
    const formCfg = state.config.form;
    if (state.formDone) {
      submitRoot.hidden = false;
      submitRoot.innerHTML = successHTML();
      return;
    }
    if (formCfg.mode === "button") {
      submitRoot.hidden = false;
      submitRoot.innerHTML = `
        <div class="rw-form-cta">
          <div class="rw-form-cta-text">
            <b>${escapeHTML(formCfg.cta.text || defaultConfig.form.cta.text)}</b>
            ${formCfg.cta.hint ? `<p>${escapeHTML(formCfg.cta.hint)}</p>` : ""}
          </div>
          <button class="rw-form-cta-btn" type="button" data-role="form-cta-open">${escapeHTML(formCfg.cta.text || defaultConfig.form.cta.text)}</button>
        </div>
      `;
      return;
    }
    submitRoot.hidden = false;
    submitRoot.innerHTML = `
      <div class="rw-submit-head">
        <div>
          <h3>${escapeHTML(formCfg.title || defaultConfig.form.title)}</h3>
          <p>Отзыв появится после проверки модератором.</p>
          ${state.submission.message && !state.submission.expanded ? `<p class="rw-submit-ok">${escapeHTML(state.submission.message)}</p>` : ""}
        </div>
        <button class="rw-submit-toggle" type="button" data-role="submit-toggle">${state.submission.expanded ? "Свернуть" : (state.config.labels.writeReview || "Написать отзыв")}</button>
      </div>
      ${state.submission.expanded ? formBodyHTML(root, state) : ""}
    `;
  }

  async function submitReview(root, state, form) {
    if (state.submission.sending) return;
    if (!(Number(state.formRating || 0) >= 1)) {
      state.formError = "Выберите оценку — без неё отзыв не публикуется";
      render(root, state);
      return;
    }
    state.formRating = Number(state.formRating);
    state.submission.sending = true;
    state.formError = "";
    state.submission.error = "";
    state.submission.message = "";
    render(root, state);
    try {
      const formData = new FormData(form);
      formData.set("rating", String(state.formRating));
      formData.set("sellerArticle", state.sellerArticle || formData.get("sellerArticle") || "");
      // W34: заголовок уходит только если заполнен (BE принимает опциональное title ≤512).
      const titleValue = String(formData.get("title") || "").trim();
      if (titleValue) {
        formData.set("title", titleValue.slice(0, 512));
      } else {
        formData.delete("title");
      }
      formData.set("openedAt", String(state.submission.openedAt));
      if (state.formMedia && state.formMedia.length) {
        formData.delete("media");
        state.formMedia.forEach((entry) => formData.append("media", entry.file, entry.file.name));
      }
      const custom = {};
      formData.forEach((value, key) => {
        if (key.indexOf("custom-") === 0 && typeof value === "string" && value) {
          custom[key.slice(7)] = value;
        }
      });
      if (Object.keys(custom).length) {
        formData.set("custom", JSON.stringify(custom));
      }
      const response = await fetch(state.submissionUrl, { method: "POST", body: formData });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Не удалось отправить отзыв" }));
        throw new Error(payload.error || "Не удалось отправить отзыв");
      }
      state.submission.sending = false;
      state.submission.expanded = false;
      state.submission.message = "";
      state.formDone = true;
      state.formMedia = [];
      state.formRating = 0;
      state.submission.openedAt = Date.now();
      render(root, state);
    } catch (error) {
      state.submission.sending = false;
      state.formError = error.message || "Не удалось отправить отзыв";
      state.submission.error = "";
      render(root, state);
    }
  }

  // ── Questions tab ──────────────────────────────────────────────────────────

  function renderQuestionsPanel(root, state) {
    const qaList = root.querySelector('[data-role="qa-list"]');
    const qaStatus = root.querySelector('[data-role="qa-status"]');
    const qaSubmit = root.querySelector('[data-role="qa-submit"]');
    if (!qaList) return;

    // Update question count badge
    const qCountEl = root.querySelector('[data-role="question-count"]');
    if (qCountEl) qCountEl.textContent = String(state.questions.items.length);

    if (state.questions.loading) {
      qaList.innerHTML = "";
      if (qaStatus) { qaStatus.textContent = "Загружаем вопросы"; qaStatus.hidden = false; }
    } else if (state.questions.error) {
      qaList.innerHTML = "";
      if (qaStatus) { qaStatus.textContent = state.questions.error; qaStatus.hidden = false; }
    } else if (state.questions.items.length === 0) {
      qaList.innerHTML = "";
      if (qaStatus) { qaStatus.textContent = "Вопросов пока нет"; qaStatus.hidden = false; }
    } else {
      if (qaStatus) qaStatus.hidden = true;
      qaList.innerHTML = state.questions.items.map((q) => {
        const date = q.date ? new Date(q.date) : null;
        const dateStr = date && !isNaN(date)
          ? date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
          : "";
        return `
          <div class="rw-qa-item">
            <div class="rw-qa-question">
              <span class="rw-qa-label">Вопрос</span>
              <p>${escapeHTML(q.question || "")}</p>
            </div>
            <div class="rw-qa-answer">
              <span class="rw-qa-label">Ответ продавца</span>
              <p>${escapeHTML(q.answer || "")}</p>
              ${dateStr ? `<time class="rw-qa-date" datetime="${escapeAttribute(q.date || "")}">${escapeHTML(dateStr)}</time>` : ""}
            </div>
          </div>
        `;
      }).join("");
    }

    renderQuestionForm(root, state, qaSubmit);
  }

  function renderQuestionForm(root, state, submitRoot) {
    if (!submitRoot) return;
    const qf = state.questionForm;
    const apiBase = state._questionsApiBase || "";
    // Only show question form when there is an API base to POST to.
    if (!apiBase || state.context !== "product") {
      submitRoot.hidden = true;
      submitRoot.innerHTML = "";
      return;
    }
    submitRoot.hidden = false;
    const privacyUrl = state.submission.config && state.submission.config.privacyUrl
      ? state.submission.config.privacyUrl
      : (state._submissionConfig && state._submissionConfig.privacyUrl ? state._submissionConfig.privacyUrl : "");
    const consentText = "Согласие на обработку персональных данных";
    const consent = privacyUrl
      ? `<a href="${escapeAttribute(privacyUrl)}" target="_blank" rel="noreferrer">${consentText}</a>`
      : consentText;
    submitRoot.innerHTML = `
      <div class="rw-submit-head">
        <div>
          <h3>Задать вопрос</h3>
          <p>Вопрос появится после ответа продавца.</p>
          ${qf.message && !qf.expanded ? `<p class="rw-submit-ok">${escapeHTML(qf.message)}</p>` : ""}
        </div>
        <button class="rw-submit-toggle" type="button" data-role="qa-submit-toggle">${qf.expanded ? "Свернуть" : "Задать вопрос"}</button>
      </div>
      ${qf.expanded ? `
        <form class="rw-submit-form" data-role="qa-submit-form">
          <input type="text" name="website" class="rw-hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <input type="hidden" name="openedAt" value="${qf.openedAt}" />
          <input type="hidden" name="sellerArticle" value="${escapeAttribute(state.sellerArticle)}" />
          <div class="rw-submit-grid rw-submit-grid-qa">
            <label class="rw-field"><span>Имя</span><input name="authorName" required maxlength="80" autocomplete="name" /></label>
            <label class="rw-field"><span>Email</span><input name="authorEmail" type="email" required maxlength="320" autocomplete="email" /></label>
            <label class="rw-field rw-submit-wide"><span>Вопрос</span><textarea name="text" required maxlength="2000" rows="4"></textarea></label>
          </div>
          <label class="rw-consent"><input name="privacyConsent" type="checkbox" required /> <span>Я даю ${consent}</span></label>
          <div class="rw-submit-actions">
            <button class="rw-submit-send" type="submit" ${qf.sending ? "disabled" : ""}>${qf.sending ? "Отправляем" : "Отправить вопрос"}</button>
            ${qf.message ? `<span class="rw-submit-ok">${escapeHTML(qf.message)}</span>` : ""}
            ${qf.error ? `<span class="rw-submit-error">${escapeHTML(qf.error)}</span>` : ""}
          </div>
        </form>
      ` : ""}
    `;
  }

  async function loadQuestions(root, state) {
    const apiBase = state._questionsApiBase || "";
    if (!apiBase || !state.sellerArticle) {
      state.questions.loaded = true;
      render(root, state);
      return;
    }
    state.questions.loading = true;
    state.questions.error = "";
    render(root, state);
    try {
      const url = `${apiBase}/api/questions?article=${encodeURIComponent(state.sellerArticle)}${state._publicKey ? `&public_key=${encodeURIComponent(state._publicKey)}` : ""}`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`API вернул ${response.status}`);
      }
      const payload = await response.json();
      // Server returns {"questions": [{question, answer, date}, ...]}
      state.questions.items = Array.isArray(payload) ? payload : (payload.questions || []);
      state.questions.loading = false;
      state.questions.loaded = true;

      // Update question count badge
      const qCountEl = root.querySelector('[data-role="question-count"]');
      if (qCountEl) qCountEl.textContent = String(state.questions.items.length);

      render(root, state);
    } catch (error) {
      state.questions.loading = false;
      state.questions.loaded = true;
      state.questions.error = error.message || "Не удалось загрузить вопросы";
      render(root, state);
    }
  }

  async function submitQuestion(root, state, form) {
    if (state.questionForm.sending) return;
    state.questionForm.sending = true;
    state.questionForm.error = "";
    state.questionForm.message = "";
    render(root, state);
    try {
      const formData = new FormData(form);
      formData.set("sellerArticle", state.sellerArticle || formData.get("sellerArticle") || "");
      formData.set("openedAt", String(state.questionForm.openedAt));
      const apiBase = state._questionsApiBase || "";
      const url = `${apiBase}/api/questions${state._publicKey ? `?public_key=${encodeURIComponent(state._publicKey)}` : ""}`;
      const response = await fetch(url, { method: "POST", body: formData });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Не удалось отправить вопрос" }));
        throw new Error(payload.error || "Не удалось отправить вопрос");
      }
      state.questionForm.sending = false;
      state.questionForm.expanded = false;
      state.questionForm.message = "Вопрос отправлен";
      state.questionForm.openedAt = Date.now();
      render(root, state);
    } catch (error) {
      state.questionForm.sending = false;
      state.questionForm.error = error.message || "Не удалось отправить вопрос";
      render(root, state);
    }
  }

  // ── End questions tab ───────────────────────────────────────────────────────

  function segmentButton(label, pressed, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rw-segment";
    button.setAttribute("aria-pressed", String(pressed));
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function isUserMediaURL(rawUrl) {
    return /(^|\/)user-media\//.test(String(rawUrl || ""));
  }

  // Visitor-submitted media is returned by the API as a server-relative path
  // (/user-media/<token>). When the widget is embedded cross-origin, resolve it
  // against the reviews server so the <img>/<video>/href all point at the right
  // host. Marketplace CDN URLs (already absolute) pass through untouched.
  function absolutizeUserMedia(item, proxyBase) {
    if (!item || !proxyBase) {
      return item;
    }
    const fix = (url) =>
      url && isUserMediaURL(url) && !/^https?:\/\//i.test(url)
        ? proxyBase.replace(/\/$/, "") + url
        : url;
    return { ...item, url: fix(item.url), previewUrl: fix(item.previewUrl) };
  }

  // Visitor-submitted media is served straight from the reviews server and must
  // NOT pass through the face-blur proxy: the author consented to publication,
  // so their photos are shown as uploaded. Marketplace CDN images still go
  // through /media for face blur.
  function resolveDirectURL(rawUrl, proxyBase) {
    if (/^https?:\/\//i.test(rawUrl)) {
      return rawUrl;
    }
    if (!proxyBase) {
      return rawUrl;
    }
    return proxyBase.replace(/\/$/, "") + rawUrl;
  }

  function mediaProxyURL(rawUrl, proxyBase) {
    if (!rawUrl) {
      return "";
    }
    if (isUserMediaURL(rawUrl)) {
      return resolveDirectURL(rawUrl, proxyBase);
    }
    if (!proxyBase) {
      return rawUrl;
    }
    return proxyBase.replace(/\/$/, "") + "/media?u=" + encodeURIComponent(rawUrl);
  }

  function initials(name) {
    const words = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return words
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "П";
  }

  function normalizeReviews(reviews, config) {
    return reviews
      .map((review) => applyMarketplacePolicy({
        ...review,
        rating: Number(review.rating || 0),
        title: String(review.title || "").trim(),
        product: review.product && typeof review.product === "object"
          ? { name: String(review.product.name || ""), price: String(review.product.price || "") }
          : null,
        createdAt: new Date(review.createdAt),
        media: (review.media || []).map((item) => ({
          ...item,
          duration: formatMediaDuration(item.duration),
          likes: Number.isFinite(Number(item.likes)) && Number(item.likes) > 0 ? Math.round(Number(item.likes)) : 0,
        })),
        pinned: Boolean(review.pinned),
      }, config))
      .filter(Boolean);
  }

  // BE: media[].duration — float seconds (0 = скрыть). Рендер «0:24».
  function formatMediaDuration(seconds) {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n <= 0) return "";
    const total = Math.round(n);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
  }

  function marketplacePolicyFor(marketplace, config) {
    return (config && config.marketplacePolicy && config.marketplacePolicy[marketplace]) || {};
  }

  function applyMarketplacePolicy(review, config) {
    const policy = marketplacePolicyFor(review.marketplace, config);
    if (policy.hidden) {
      return null;
    }
    if (policy.label) {
      review.marketplaceLabel = policy.label;
    }
    if (policy.showSourceLinks === false) {
      review.marketplaceReviewUrl = "";
      review.marketplaceProductUrl = "";
    }
    return review;
  }

  function shouldTrustAggregate(config) {
    return !Object.values(config.marketplacePolicy || {}).some((policy) => policy && policy.hidden);
  }

  function normalizeAggregate(aggregate) {
    if (!aggregate) {
      return null;
    }
    const totalReviews = Number(aggregate.totalReviews ?? aggregate.count ?? 0);
    const ratingCount = Number(aggregate.ratingCount ?? totalReviews);
    const averageRating = Number(aggregate.averageRating ?? aggregate.ratingAvg ?? 0);
    const recommendPercent = Number(aggregate.recommendPercent);
    return {
      totalReviews: Number.isFinite(totalReviews) ? totalReviews : 0,
      ratingCount: Number.isFinite(ratingCount) ? ratingCount : 0,
      averageRating: Number.isFinite(averageRating) ? averageRating : 0,
      ...(Number.isFinite(recommendPercent) ? { recommendPercent } : {}),
    };
  }

  const widgetSections = { summary: true, player: true, media: true, filters: true, list: true, form: true };

  function normalizeSections(raw, visibility) {
    // Legacy configs published before `sections` gated blocks via visibility flags.
    const hidden = {};
    if (visibility) {
      if (visibility.ratingDistribution === false) hidden.summary = true;
      if (visibility.photos === false) hidden.media = true;
      if (visibility.filters === false) hidden.filters = true;
    }
    const out = [];
    const seen = {};
    for (const id of Array.isArray(raw) && raw.length ? raw : defaultConfig.layout.sections) {
      if (!widgetSections[id] || seen[id] || hidden[id]) continue;
      seen[id] = true;
      out.push(id);
    }
    // The list is the point of the widget — always render it.
    if (!seen.list) out.push("list");
    return out;
  }

  function normalizeConfig(config) {
    config = config || {};
    const merged = {
      theme: { ...defaultConfig.theme, ...(config.theme || {}) },
      typography: { ...defaultConfig.typography, ...(config.typography || {}) },
      layout: { ...defaultConfig.layout, ...(config.layout || {}) },
      header: { ...defaultConfig.header, ...(config.header || {}) },
      answers: { ...defaultConfig.answers, ...(config.answers || {}) },
      viewer: { ...defaultConfig.viewer, ...(config.viewer || {}) },
      filters: { ...defaultConfig.filters, ...(config.filters || {}) },
      appearance: { ...defaultConfig.appearance, ...(config.appearance || {}) },
      visibility: { ...defaultConfig.visibility, ...(config.visibility || {}) },
      defaults: { ...defaultConfig.defaults, ...(config.defaults || {}) },
      labels: { ...defaultConfig.labels, ...(config.labels || {}) },
      form: {
        ...defaultConfig.form,
        ...(config.form || {}),
        cta: { ...defaultConfig.form.cta, ...((config.form || {}).cta || {}) },
      },
      customFields: normalizeCustomFields(config.customFields || []),
      customTags: { ...defaultConfig.customTags, ...(config.customTags || {}) },
      ranking: Array.isArray(config.ranking) && config.ranking.length ? config.ranking : defaultConfig.ranking,
      marketplacePolicy: normalizeMarketplacePolicy(config.marketplacePolicy),
    };
    merged.header.title = String(merged.header.title || "").trim() || defaultConfig.header.title;
    if (!["row", "stack", "center"].includes(merged.header.layout)) {
      merged.header.layout = "row";
    }
    merged.header.elements = { ...defaultConfig.header.elements, ...(merged.header.elements || {}) };
    ["title", "rating", "count", "recommend", "distribution"].forEach((key) => {
      merged.header.elements[key] = merged.header.elements[key] !== false;
    });
    if (!["card", "plain", "bubble", "accent"].includes(merged.answers.style)) {
      merged.answers.style = "card";
    }
    merged.answers.color = normalizeHexColor(merged.answers.color) || defaultConfig.answers.color;
    merged.answers.title = String(merged.answers.title || "").trim();
    merged.answers.showTitle = merged.answers.showTitle !== false;
    if (merged.viewer.chrome !== "min") {
      merged.viewer.chrome = "full";
    }
    merged.viewer.showOriginal = merged.viewer.showOriginal !== false;
    merged.viewer.showCounter = merged.viewer.showCounter !== false;
    if (!["rows", "dropdowns", "chips"].includes(merged.filters.layout)) {
      merged.filters.layout = "rows";
    }
    merged.filters.collapsible = merged.filters.collapsible === true;
    merged.filters.multiSelect = merged.filters.multiSelect === true;
    merged.filters.labelMode = merged.filters.labelMode === "plain" ? "plain" : "all";
    if (![
      "default",
      "native-kit",
      "minimal",
      "ugc-editorial",
      "ugc-community",
      "bazaar",
    ].includes(merged.appearance.preset)) {
      merged.appearance.preset = "default";
    }
    merged.appearance.viewAllHref = String(merged.appearance.viewAllHref || "").trim();
    merged.typography.scale = clampNumber(merged.typography.scale, 0.85, 1.25, 1);
    merged.typography.radius = Math.round(clampNumber(merged.typography.radius, 0, 24, 16));
    merged.layout.columns = Math.round(clampNumber(merged.layout.columns, 1, 4, 2));
    merged.layout.pageSize = Math.round(clampNumber(merged.layout.pageSize, 1, 24, 3));
    merged.layout.pagination = merged.layout.pagination === "pages" ? "pages" : "more";
    const mediacard = { ...defaultConfig.layout.mediacard, ...(merged.layout.mediacard || {}) };
    mediacard.layout = ["row", "grid", "collage", "one"].includes(mediacard.layout) ? mediacard.layout : "row";
    mediacard.aspect = ["16:10", "1:1", "4:5"].includes(mediacard.aspect) ? mediacard.aspect : "16:10";
    mediacard.maxTiles = [3, 4, 6].includes(mediacard.maxTiles) ? mediacard.maxTiles : 4;
    mediacard.plusMore = mediacard.plusMore !== false;
    merged.layout.mediacard = mediacard;
    const video = merged.layout.video || {};
    video.aspect = ["3:4", "9:16", "1:1"].includes(video.aspect) ? video.aspect : "9:16";
    video.tileWidth = Math.round(clampNumber(video.tileWidth, 120, 200, 156));
    video.showAuthor = video.showAuthor !== false;
    video.autoplayInViewer = video.autoplayInViewer !== false;
    video.productPanel = video.productPanel !== false;
    const player = { ...defaultConfig.layout.player, ...(merged.layout.player || {}) };
    player.tile = { ...defaultConfig.layout.player.tile, ...(player.tile || {}) };
    player.tile.aspect = ["9:16", "3:4", "1:1"].includes(player.tile.aspect) ? player.tile.aspect : "9:16";
    player.tile.width = Math.round(clampNumber(player.tile.width, 120, 200, 156));
    player.showAuthor = player.showAuthor !== false;
    player.showLikes = player.showLikes !== false;
    player.showSourceBadge = player.showSourceBadge !== false;
    player.autoAdvance = { ...defaultConfig.layout.player.autoAdvance, ...(player.autoAdvance || {}) };
    player.autoAdvance.intervalSec = clampNumber(player.autoAdvance.intervalSec, 4, 10, 5);
    player.autoAdvance.pauseOnHover = player.autoAdvance.pauseOnHover !== false;
    merged.layout.player = player;
    merged.layout.tileHover = merged.layout.tileHover !== false;
    merged.layout.sections = normalizeSections(merged.layout.sections, merged.visibility);
    if (!["list", "grid", "carousel", "video", "wall"].includes(merged.layout.mode)) {
      merged.layout.mode = "list";
    }
    merged.layout.video = video;
    const wall = merged.layout.wall || {};
    wall.minTileWidth = Math.round(clampNumber(wall.minTileWidth, 140, 320, 200));
    wall.gap = Math.round(clampNumber(wall.gap, 0, 48, 12));
    wall.maxTiles = Math.round(clampNumber(wall.maxTiles, 1, 96, 24));
    merged.layout.wall = wall;
    merged.visibility.videoRail = merged.visibility.videoRail !== false;
    merged.form = {
      ...defaultConfig.form,
      ...(merged.form || {}),
      fields: { ...defaultConfig.form.fields, ...((merged.form || {}).fields || {}) },
      cta: { ...defaultConfig.form.cta, ...((merged.form || {}).cta || {}) },
    };
    merged.form.mode = merged.form.mode === "button" ? "button" : "inline";
    merged.form.title = String(merged.form.title || "").trim() || defaultConfig.form.title;
    merged.form.submitLabel = String(merged.form.submitLabel || "").trim() || defaultConfig.form.submitLabel;
    ["title", "email", "media"].forEach((key) => {
      merged.form.fields[key] = merged.form.fields[key] !== false;
    });
    merged.form.maxMedia = [1, 3, 6].includes(merged.form.maxMedia) ? merged.form.maxMedia : 3;
    merged.form.mediaHint = String(merged.form.mediaHint || "").trim();
    merged.form.cta.text = String(merged.form.cta.text || "").trim() || defaultConfig.form.cta.text;
    merged.form.cta.hint = String(merged.form.cta.hint || "").trim();
    merged.customTags = { ...defaultConfig.customTags, ...(merged.customTags || {}) };
    if (!["section", "header", "both"].includes(merged.form.ctaMode)) {
      merged.form.ctaMode = "section";
    }
    merged.customTags.display = merged.customTags.display === "string" ? "string" : "chips";
    merged.customTags.chipLabel = merged.customTags.chipLabel !== false;
    merged.defaults.initialSort = String(merged.defaults.initialSort || "relevance").trim();
    if (!["relevance", "newest", "highest", "lowest", "media"].includes(merged.defaults.initialSort)) {
      merged.defaults.initialSort = "relevance";
    }
    if (!["all", "wb", "ozon", "ym"].includes(merged.defaults.marketplace)) {
      merged.defaults.marketplace = "all";
    }
    return merged;
  }

  function normalizeMarketplacePolicy(policy) {
    const normalized = {};
    Object.keys(defaultConfig.marketplacePolicy).forEach((marketplace) => {
      normalized[marketplace] = {
        ...defaultConfig.marketplacePolicy[marketplace],
        ...((policy && policy[marketplace]) || {}),
      };
      normalized[marketplace].hidden = Boolean(normalized[marketplace].hidden);
      normalized[marketplace].label = String(normalized[marketplace].label || "").trim();
      normalized[marketplace].showSourceLinks = normalized[marketplace].showSourceLinks !== false;
    });
    return normalized;
  }

  function initialVisible(config) {
    return config.layout.pageSize;
  }

  function resetListingState(state) {
    state.visible = initialVisible(state.config);
    state.expanded = true;
  }

  function effectiveVisibleCount(state, total) {
    return Math.min(total, state.visible);
  }

  function summaryAggregate(reviews, state) {
    const fallback = aggregateFromReviews(reviews);
    const remote = state.aggregate && state.aggregate.totalReviews > 0 ? state.aggregate : null;
    // Входной aggregate доверяется в любом контексте (владелец: макет шлёт
    // агрегат 4,7/312 для карточки товара); при отсутствии — считаем из отзывов.
    const chosen = remote || fallback;
    if (remote && Number.isFinite(remote.recommendPercent)) chosen.recommendPercent = remote.recommendPercent;
    return chosen;
  }

  function aggregateFromReviews(reviews) {
    const rated = reviews.filter((review) => review.rating > 0);
    const sum = rated.reduce((total, review) => total + review.rating, 0);
    return {
      totalReviews: reviews.length,
      ratingCount: rated.length,
      averageRating: rated.length ? sum / rated.length : 0,
    };
  }

  function normalizeHexColor(value) {
    if (typeof value !== "string") return "";
    const v = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(v)) {
      return "#" + v.slice(1).split("").map((c) => c + c).join("").toLowerCase();
    }
    return "";
  }

  function colorChannels(value, fallback) {
    let hex = String(value || "").trim().replace(/^#/, "");
    if (hex.length === 3) {
      hex = hex.replace(/./g, (digit) => digit + digit);
    }
    if (!/^[0-9a-f]{6}$/i.test(hex)) {
      return colorChannels(fallback, "#000000");
    }
    return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  }

  function mixChannels(base, overlay, overlayWeight) {
    return `#${base.map((channel, index) =>
      Math.round(channel * (1 - overlayWeight) + overlay[index] * overlayWeight)
        .toString(16)
        .padStart(2, "0")
    ).join("")}`;
  }

  function rgba(channels, alpha) {
    return `rgba(${channels.join(", ")}, ${alpha})`;
  }
  function applyConfig(root, config) {
    const siteStyle = config.typography.inheritSite ? getComputedStyle(root.ownerDocument.body) : null;
    const siteValue = (name, fallback) => siteStyle?.getPropertyValue(name).trim() || fallback;
    const theme = config.typography.inheritSite ? {
      ...config.theme,
      accent: siteValue("--ys-color-token-brand-primary", config.theme.accent),
      accentInk: siteValue("--ys-color-token-brand-primary-contrast", config.theme.accentInk),
      text: siteValue("--ys-color-token-text-primary", config.theme.text),
      muted: siteValue("--ys-color-token-text-secondary", config.theme.muted),
      panel: siteValue("--ys-background-primary", config.theme.panel),
      border: siteValue("--ys-color-token-border-primary", config.theme.border),
    } : config.theme;
    const accent = colorChannels(theme.accent, defaultConfig.theme.accent);
    const text = colorChannels(theme.text, defaultConfig.theme.text);
    const muted = colorChannels(theme.muted, defaultConfig.theme.muted);
    const panel = colorChannels(theme.panel, defaultConfig.theme.panel);
    const star = colorChannels(theme.star, defaultConfig.theme.star);
    const trust = colorChannels("#4E7C59", "#4E7C59");

    root.__reviewsWidgetConfig = config;
    root.style.setProperty("--rw-text", theme.text);
    root.style.setProperty("--rw-muted", theme.muted);
    root.style.setProperty("--rw-border", theme.border);
    root.style.setProperty("--rw-panel", theme.panel);
    root.style.setProperty("--rw-accent", theme.accent);
    root.style.setProperty("--rw-accent-ink", theme.accentInk);
    root.style.setProperty("--rw-accent-hover", mixChannels(accent, [0, 0, 0], 0.15));
    root.style.setProperty("--rw-soft", mixChannels(panel, text, 0.04));
    root.style.setProperty("--rw-soft-muted", mixChannels(panel, muted, 0.55));
    root.style.fontFamily = config.typography.inheritSite
      ? siteValue("--ys-font-family", "inherit")
      : config.typography.fontFamily || defaultConfig.typography.fontFamily;
    root.classList.toggle("rw-preset-native-kit", config.appearance?.preset === "native-kit");
    root.classList.toggle("rw-inherit-site", config.typography.inheritSite || config.appearance?.preset === "native-kit");
    root.classList.toggle("rw-preset-minimal", config.appearance?.preset === "minimal");
    root.classList.toggle("rw-preset-ugc-editorial", config.appearance?.preset === "ugc-editorial");
    root.classList.toggle("rw-preset-ugc-community", config.appearance?.preset === "ugc-community");
    root.classList.toggle("rw-preset-bazaar", config.appearance?.preset === "bazaar");
    root.classList.toggle("rw-density-compact", config.typography.density === "compact");
    root.classList.toggle("rw-layout-grid", config.layout.mode === "grid");
    root.classList.toggle("rw-layout-carousel", config.layout.mode === "carousel");
    root.classList.toggle("rw-layout-video", config.layout.mode === "video");
    root.classList.toggle("rw-layout-wall", config.layout.mode === "wall");
    root.style.setProperty("--rw-wall-tile-min", `${config.layout.wall.minTileWidth}px`);
    root.style.setProperty("--rw-wall-gap", `${config.layout.wall.gap}px`);
    root.style.setProperty("--rw-video-card-width", `${config.layout.video.tileWidth}px`);
    root.style.setProperty("--rw-video-card-ratio", config.layout.video.aspect === "3:4" ? "3 / 4" : config.layout.video.aspect.replace(":", " / "));
    root.style.setProperty("--rw-radius", `${config.typography.radius}px`);
    root.style.setProperty("--rw-font-scale", String(config.typography.scale || 1));
    root.style.setProperty("--rw-columns", String(config.layout.columns));
    root.style.setProperty("--rw-star", theme.star);
    root.classList.toggle("rw-hide-distribution", !config.visibility.ratingDistribution);
    root.classList.toggle("rw-hide-badges", !config.visibility.marketplaceBadges);
    root.classList.toggle("rw-hide-filters", !config.visibility.filters);

    // Тёмная тема как в макете: тумблер вешает только класс .rw-dark; токены
    // берутся из config.theme (макет: инлайн state.* бьют .dark-класс, карточки
    // остаются на светлой панели, темнеют лишь класс-зависимые правила).
    root.classList.toggle("rw-dark", config.theme.dark === true);

    // Схема шапки: ряд / стопка / центр.
    root.classList.toggle("rw-head-stack", config.header.layout === "stack");
    root.classList.toggle("rw-head-center", config.header.layout === "center");

    // Ответ продавца: цвет и стиль.
    const answers = config.answers || defaultConfig.answers;
    const ansChannels = colorChannels(answers.color, defaultConfig.answers.color);
    root.style.setProperty("--rw-ans", normalizeHexColor(answers.color) || defaultConfig.answers.color);
    root.style.setProperty("--rw-ans-tint", mixChannels(ansChannels, colorChannels(theme.panel, "#ffffff"), 0.92));
    root.style.setProperty("--rw-ans-border", mixChannels(ansChannels, colorChannels(theme.panel, "#ffffff"), 0.72));
    root.classList.toggle("rw-ans-plain", answers.style === "plain");
    root.classList.toggle("rw-ans-bubble", answers.style === "bubble");
    root.classList.toggle("rw-ans-accent", answers.style === "accent");

    // Хром просмотрщика: минималистичный прячет верхнюю панель.
    root.classList.toggle("rw-viewer-min", config.viewer.chrome === "min");

    // Пагинация и медикарточка.
    root.classList.toggle("rw-pag-pages", config.layout.pagination === "pages");
    root.style.setProperty("--rw-mc-aspect", { "16:10": "16 / 10", "1:1": "1 / 1", "4:5": "4 / 5" }[config.layout.mediacard.aspect] || "16 / 10");

    // Элементы шапки.
    root.classList.toggle("rw-he-no-title", config.header.elements.title === false);
    root.classList.toggle("rw-he-no-rating", config.header.elements.rating === false);
    root.classList.toggle("rw-he-no-count", config.header.elements.count === false);
    root.classList.toggle("rw-he-no-recommend", config.header.elements.recommend === false);
  }

  function clampNumber(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  async function fetchReviews(source) {
    const response = await fetch(source, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`API вернул ${response.status}`);
    }
    const payload = await response.json();
    if (Array.isArray(payload)) {
      return { reviews: payload, aggregate: null };
    }
    return { reviews: payload.reviews || [], aggregate: payload.aggregate || null };
  }

  async function fetchSubmissionConfig(source) {
    const response = await fetch(source, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`API вернул ${response.status}`);
    }
    return response.json();
  }

  async function loadMoreReviews(root, state) {
    state.loadingMore = true;
    state.moreError = "";
    render(root, state);
    try {
      const payload = await fetchReviews(pagedSource(state.fullFeedSource, state.fullFeedOffset, state.fullFeedLimit));
      const next = normalizeReviews(payload.reviews, state.config);
      const existing = new Set(state.reviews.map(reviewKey));
      const uniqueNext = next.filter((review) => {
        const key = reviewKey(review);
        if (existing.has(key)) {
          return false;
        }
        existing.add(key);
        return true;
      });
      state.reviews = state.reviews.concat(uniqueNext);
      state.fullFeedOffset += next.length;
      state.visible = state.reviews.length;
      if (next.length < state.fullFeedLimit) {
        state.fullFeedExhausted = true;
      }
      state.loadingMore = false;
      render(root, state);
    } catch (error) {
      state.loadingMore = false;
      state.moreError = error.message || "Не удалось загрузить отзывы";
      render(root, state);
    }
  }

  function pagedSource(source, offset, limit) {
    const url = new URL(source, window.location.href);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", String(limit));
    return url.toString();
  }

  function reviewKey(review) {
    if (review.id != null) {
      return `id:${review.id}`;
    }
    if (review.marketplace && review.externalReviewId) {
      return `${review.marketplace}:${review.externalReviewId}`;
    }
    return `${review.marketplace || ""}:${review.externalProductId || ""}:${review.createdAt ? review.createdAt.toISOString() : ""}:${review.authorName || ""}`;
  }

  function sortReviews(reviews, sort, config) {
    return [...reviews].sort((a, b) => {
      if (sort === "relevance") return compareByRanking(a, b, effectiveRanking(config));
      if (sort === "highest") return b.rating - a.rating || b.createdAt - a.createdAt;
      if (sort === "lowest") return a.rating - b.rating || b.createdAt - a.createdAt;
      if (sort === "media") return Number(b.media.length > 0) - Number(a.media.length > 0) || b.createdAt - a.createdAt;
      return b.createdAt - a.createdAt;
    });
  }

  function compareByRanking(a, b, ranking) {
    const rules = ranking && ranking.length ? ranking : defaultConfig.ranking;
    for (const rule of rules) {
      const av = rankingValue(a, rule.field);
      const bv = rankingValue(b, rule.field);
      if (av === bv) continue;
      return rule.direction === "asc" ? av - bv : bv - av;
    }
    return b.createdAt - a.createdAt;
  }

  function effectiveRanking(config) {
    return (config.ranking && config.ranking.length ? config.ranking : defaultConfig.ranking).filter((rule) => {
      if (rule.field === "hasPhoto") return config.defaults.photoFirst;
      if (rule.field === "hasText") return config.defaults.textFirst;
      return true;
    });
  }

  function rankingValue(review, field) {
    if (field === "pinned") return review.pinned ? 1 : 0;
    if (field === "hasPhoto") return review.media.some((item) => item.kind === "photo") ? 1 : 0;
    if (field === "hasText") return hasText(review) ? 1 : 0;
    if (field === "rating") return review.rating;
    if (field === "createdAt") return review.createdAt.getTime();
    return 0;
  }

  function matchesDefaults(review, defaults) {
    if (defaults.minRating > 0 && review.rating < defaults.minRating) return false;
    if (defaults.requireText && !hasText(review)) return false;
    if (defaults.requirePhoto && !review.media.some((item) => item.kind === "photo")) return false;
    if (defaults.onlyWithAnswer && (!review.answer || !review.answer.text)) return false;
    return true;
  }

  function ratingMatches(rating, selected) {
    if (selected === "all") return true;
    if (String(selected).endsWith("+")) return rating >= Number(String(selected).slice(0, -1));
    return rating === Number(selected);
  }

  function mediaMatches(review, selected) {
    if (selected === "photo") return review.media.some((item) => item.kind === "photo");
    if (selected === "video") return review.media.some((item) => item.kind === "video");
    return true;
  }

  function hasText(review) {
    return Boolean(String(review.text || "").trim() || String(review.pros || "").trim() || String(review.cons || "").trim());
  }

  function countByRating(reviews, rating) {
    return reviews.filter((review) => review.rating === rating).length;
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function labelMarketplace(value) {
    if (value === "all") return "Все площадки";
    return marketplaceLabels[value] || value;
  }

  function labelMarketplaceValue(value, reviews) {
    if (value === "all") return labelMarketplace(value);
    const review = reviews.find((item) => item.marketplace === value && item.marketplaceLabel);
    return review ? review.marketplaceLabel : labelMarketplace(value);
  }

  function reviewMarketplaceLabel(review) {
    return review.marketplaceLabel || labelMarketplace(review.marketplace);
  }

  function formatDate(date) {
    const value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) return String(date || "");
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(value);
  }

  function pluralize(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
    return `${count} ${word}`;
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHTML(value);
  }

  function mountShadow(host, options) {
    if (!host) {
      throw new Error("ReviewsWidget host is required");
    }
    options = options || {};

    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.innerHTML = "";

    if (options.styleText) {
      const style = document.createElement("style");
      style.textContent = options.styleText;
      shadow.appendChild(style);
    }

    const root = document.createElement("div");
    root.className = "reviews-widget reviews-widget-root";
    shadow.appendChild(root);

    mount(root, options);
    return shadow;
  }

  window.ReviewsWidget = {
    mount,
    mountShadow,
    sampleReviews,
    defaultConfig,
    mediaProxyURL,
  };
})();
