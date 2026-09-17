(function () {
  const widgetScriptURL = document.currentScript && document.currentScript.src;
  const marketplaceLabels = {
    wb: "Wildberries",
    ym: "Яндекс Маркет",
    ozon: "Ozon",
  };
  let marketplaceIconBase = "./assets/marketplaces/";
  if (widgetScriptURL) {
    try {
      marketplaceIconBase = new URL(marketplaceIconBase, widgetScriptURL).href;
    } catch {
      // Inline/blob embeds use page-relative assets.
    }
  }

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
      marketplaceDisplay: "text",
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
      loadMoreAction: "inline",
      mediacard: {
        layout: "row",
        aspect: "16:10",
        maxTiles: 4,
        plusMore: true,
        videoBadge: true,
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
      distribution: { position: "auto", width: "compact", density: "compact" },
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
      hideRare: false,
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
        { kind: "photo", url: "./assets/media-placeholder.svg", likes: 0, duration: 0 },
        { kind: "photo", url: "./assets/media-placeholder.svg", likes: 0, duration: 0 },
        { kind: "photo", url: "./assets/media-placeholder.svg", likes: 0, duration: 0 },
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
      media: [{ kind: "photo", url: "./assets/media-placeholder.svg", likes: 0, duration: 0 }],
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
        { kind: "photo", url: "./assets/media-placeholder.svg", likes: 96, duration: 0 },
        { kind: "photo", url: "./assets/media-placeholder.svg", likes: 0, duration: 0 },
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
      media: [{ kind: "photo", url: "./assets/media-placeholder.svg", likes: 12, duration: 0 }],
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
        { kind: "photo", url: "./assets/media-placeholder.svg", likes: 74, duration: 0 },
        { kind: "photo", url: "./assets/media-placeholder.svg", likes: 0, duration: 0 },
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
      media: [{ kind: "photo", url: "./assets/media-placeholder.svg", likes: 0, duration: 0 }],
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
    if (root.__reviewsWidget) root.__reviewsWidget.destroy();
    const config = normalizeConfig(options.config);
    const context = options.context || "product";
    const initialReviews = normalizeReviews(options.reviews || [], config);

    const state = {
      reviews: initialReviews,
      rawReviews: options.reviews || [],
      rawAggregate: options.aggregate,
      preview: options.preview === true,
      destroyed: false,
      controller: new AbortController(),
      chipState: new Set(),
      formDraft: {},
      aggregate: normalizeAggregate(options.aggregate),
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
      fullFeedStalled: false,
      fullFeedSeen: new Set(),
      fullFeedController: null,
      sourceController: new AbortController(),
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
      sourceIncomplete: false,
      error: "",
      searchQuery: "",
      expandedTexts: new Set(),
      moreError: "",
      pagerPage: 0,
      feedIndex: -1,
      feedTimer: null,
      feedPaused: false,
      viewerTimer: null,
      viewerHovered: false,
      viewerPlaying: false,
      formModalOpen: false,
      formDone: false,
      refreshCarousel: null,
      reviewsView: null,
      carouselOrder: null,
      filteredReviews: [],
      resetScroll: false,
    };
    if (!state.fullFeedOffsetExplicit) {
      state.fullFeedOffset = state.rawReviews.length;
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
      fetchReviews(options.source, state.sourceController.signal)
        .then((payload) => {
          if (state.destroyed) return;
          state.rawReviews = payload.reviews;
          state.rawAggregate = payload.aggregate;
          state.reviews = normalizeReviews(payload.reviews, state.config);
          state.aggregate = normalizeAggregate(payload.aggregate);
          state.sourceIncomplete = payload.partial;
          if (!state.fullFeedOffsetExplicit) {
            state.fullFeedOffset = payload.reviews.length;
          }
          state.loading = false;
          state.error = "";
          render(root, state);
        })
        .catch((error) => {
          if (state.destroyed) return;
          state.loading = false;
          state.error = error.message || "Не удалось загрузить отзывы";
          render(root, state);
        });
    }
    if (context === "product" && options.submissionConfigUrl) {
      fetchSubmissionConfig(options.submissionConfigUrl)
        .then((config) => {
          if (state.destroyed) return;
          state.submission.config = config;
          state.submission.loading = false;
          render(root, state);
        })
        .catch(() => {
          if (state.destroyed) return;
          state.submission.loading = false;
          render(root, state);
        });
    }
    const handle = {
      updateConfig(next) {
        if (state.destroyed) return;
        saveFormDraft(root, state);
        closeAllReviews(root, state);
        cancelMoreReviews(state);
        state.carouselOrder = null;
        state.carouselPaused = false;
        const viewer = root.querySelector('[data-role="media-viewer"]');
        const viewerKey = viewer && viewer.open && viewer.__items[viewer.__index].key;
        const modalOpen = state.formModalOpen;
        const oldDefaults = JSON.stringify(state.config.defaults);
        state.config = normalizeConfig(next);
        state.reviews = normalizeReviews(state.rawReviews, state.config);
        state.aggregate = normalizeAggregate(state.rawAggregate);
        if (JSON.stringify(state.config.defaults) !== oldDefaults) {
          state.sort = state.config.defaults.initialSort;
          state.chipState.clear();
          resetListingState(state);
        }
        if (!state.config.layout.sections.includes("filters")) state.searchQuery = "";
        if (!state.config.visibility.questions) state.activeTab = "reviews";
        clearFeedTimer(state);
        clearViewerTimer(root, state);
        state.controller.abort();
        state.controller = new AbortController();
        root.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
        root.replaceChildren(renderShell(options.productName || state.config.header.title, state.config));
        applyConfig(root, state.config);
        bind(root, state);
        state.formModalOpen = false;
        render(root, state);
        if (modalOpen && canSubmit(state)) openFormModal(root, state);
        if (viewerKey) {
          const trigger = Array.from(root.querySelectorAll("[data-media-key]")).find((node) => node.getAttribute("data-media-key") === viewerKey);
          if (trigger) openMediaViewer(root, trigger, state);
        }
      },
      destroy() {
        if (state.destroyed) return;
        state.destroyed = true;
        closeAllReviews(root, state);
        cancelMoreReviews(state);
        state.sourceController.abort();
        state.controller.abort();
        root.ownerDocument.removeEventListener("keydown", root.__reviewsWidgetKeydown);
        clearFeedTimer(state);
        clearViewerTimer(root, state);
        clearFormMedia(state);
        root.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
        root.replaceChildren();
        if (root.__reviewsWidget === handle) delete root.__reviewsWidget;
      },
    };
    root.__reviewsWidget = handle;
    return handle;
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
    // Keep title and rating together when the row header rearranges by container width.
    const showScoreBlock = he.rating || he.count || he.recommend;
    const overview = document.createElement("div");
    overview.className = "rw-head";
    overview.setAttribute("data-section", "summary");
    const distribution = config.header.distribution;
    overview.dataset.distPosition = distribution.position === "auto" ? (config.header.layout === "row" ? "beside" : "below") : distribution.position;
    overview.dataset.distWidth = distribution.width;
    overview.dataset.distDensity = distribution.density;
    overview.innerHTML = `
      ${he.title || showScoreBlock ? '<div class="rw-head-main">' : ""}
      ${he.title ? `<span class="rw-wtitle" data-role="widget-title">${escapeHTML(config.header.title || defaultConfig.header.title)}</span>` : ""}
      ${showScoreBlock ? `
      <span class="rw-sum">
        ${he.rating ? `<span class="rw-big" data-role="score">0.0</span>` : ""}
        <span>
          ${he.rating ? `<span class="rw-stars" data-role="stars" aria-label="Средний рейтинг"></span>` : ""}
          ${he.count ? `<span class="rw-count" data-role="summary"></span>` : ""}
          ${he.recommend ? `<span class="rw-recommend" data-role="recommend"></span>` : ""}
        </span>
      </span>` : ""}
      ${he.title || showScoreBlock ? '</div>' : ""}
      ${he.distribution ? `<span class="rw-dist" data-role="distwrap"></span>` : ""}
      ${formCtaHeader(config) ? `<button class="rw-hbtn" type="button" data-role="head-cta">${escapeHTML(config.form.cta.text || defaultConfig.form.cta.text)}</button>` : ""}
      ${config.customFields.some((field) => field.showInSummary) ? `<div class="rw-custom-summary rw-attrs" data-role="custom-summary"></div>` : ""}
    `;
    if (config.appearance.viewAllHref) {
      const viewAll = document.createElement("div");
      viewAll.className = "rw-view-all-row";
      viewAll.innerHTML = config.layout.loadMoreAction === "dialog"
        ? '<button class="rw-view-all" type="button">Смотреть все отзывы</button>'
        : `<a class="rw-view-all" href="${escapeAttribute(config.appearance.viewAllHref)}" target="_blank" rel="noreferrer">${escapeHTML(labels.viewAll || "Смотреть все")}</a>`;
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
      <div class="rw-results-summary" data-role="list-results" role="status" aria-live="polite"></div>
      <div class="rw-wall-wrap" data-role="wall" hidden></div>
      <nav class="rw-carousel-nav" data-role="carousel-nav" aria-label="Прокрутка отзывов" hidden>
        <button class="rw-carousel-prev" type="button" data-role="carousel-prev" aria-label="Предыдущие отзывы" disabled>‹</button>
        <button class="rw-carousel-next" type="button" data-role="carousel-next" aria-label="Следующие отзывы" disabled>›</button>
      </nav>
      <div class="rw-list" data-role="list"${config.layout.mode === "carousel" ? ' role="region" aria-label="Карусель отзывов" tabindex="0"' : ""}></div>
      <div class="rw-empty" data-role="status" hidden></div>
      <div class="rw-footer">
        <button class="rw-load-more" type="button" data-role="load-more">Показать ещё</button>
        <nav class="rw-pager" data-role="pager" hidden aria-label="Страницы отзывов"></nav>
      </div>
    `;

    const reviewsDialog = document.createElement("dialog");
    reviewsDialog.className = "rw-reviews-dialog";
    reviewsDialog.setAttribute("data-role", "all-reviews");
    reviewsDialog.setAttribute("aria-label", "Все отзывы покупателей");
    reviewsDialog.innerHTML = `
      <div class="rw-reviews-card">
        <header class="rw-reviews-head">
          <h2>Все отзывы покупателей</h2>
          <span data-role="results-count" role="status" aria-live="polite"></span>
          <button type="button" data-role="reset-filters">Сбросить фильтры</button>
          <button type="button" data-role="all-reviews-close" aria-label="Закрыть все отзывы" autofocus>×</button>
        </header>
        <div class="rw-reviews-body"></div>
      </div>
    `;
    if (!config.layout.sections.includes("filters")) reviewsDialog.querySelector(".rw-reviews-body").appendChild(filterBar);

    const viewer = document.createElement("dialog");
    viewer.className = "rw-media-viewer";
    viewer.setAttribute("data-role", "media-viewer");
    const viewerCfg = config.viewer || defaultConfig.viewer;
    const viewerMin = viewerCfg.chrome === "min";
    viewer.innerHTML = `
      <div class="rw-media-dialog${viewerMin ? " rw-media-dialog-min" : ""}" data-role="viewer-dialog">
        <div class="rw-media-dialog-top">
          ${viewerMin ? "" : `<div class="rw-media-who" data-role="viewer-who"><span class="rw-avatar rw-who-avatar" data-role="viewer-avatar"></span><span class="rw-who-line"><b data-role="viewer-name"></b><span class="rw-when" data-role="viewer-when"></span></span><span class="rw-stars rw-who-stars" data-role="viewer-stars"></span></div>`}
          <span class="rw-media-tools">
            ${viewerCfg.showCounter ? `<span class="rw-media-counter" data-role="viewer-count"></span>` : ""}
            ${viewerCfg.showOriginal ? `<a class="rw-media-original" data-role="viewer-original" href="#" target="_blank" rel="noreferrer">Открыть оригинал</a>` : ""}
          </span>
          <button class="rw-media-close" type="button" data-role="viewer-close" aria-label="Закрыть просмотр">×</button>
        </div>
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
    fragment.append(questionsPanel, reviewsDialog, viewer, formModal);
    return fragment;
  }

  function bind(root, state) {
    const signal = state.controller.signal;
    if (root.__reviewsWidgetKeydown) {
      root.ownerDocument.removeEventListener("keydown", root.__reviewsWidgetKeydown);
    }
    root.__reviewsWidgetKeydown = (event) => {
      const star = event.target.closest && event.target.closest('[data-role="form-star"]');
      if (star && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const value = Number(star.dataset.star);
        state.formRating = event.key === "Home" ? 1 : event.key === "End" ? 5 : Math.max(1, Math.min(5, value + (["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : -1)));
        const form = star.closest("form");
        updateFormControls(form, state);
        form.querySelector(`[data-star="${state.formRating}"]`).focus();
        return;
      }
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
    root.addEventListener("keydown", root.__reviewsWidgetKeydown, { signal });

    if (root.__reviewsWidgetMediaClick) {
      root.removeEventListener("click", root.__reviewsWidgetMediaClick);
    }
    root.__reviewsWidgetMediaClick = (event) => {
      const reviewsClose = event.target.closest('[data-role="all-reviews-close"]');
      if (reviewsClose) { closeAllReviews(root, state); return; }
      const distribution = event.target.closest('.rw-dist-row[data-rating]');
      if (distribution && root.contains(distribution)) {
        if (!distribution.disabled) toggleFilterChip(root, state, "rating", distribution.dataset.rating);
        return;
      }
      const resetFilters = event.target.closest('[data-role="reset-filters"]');
      if (resetFilters) {
        state.chipState.clear(); state.searchQuery = ""; state.rating = "all"; state.mediaFilter = "all";
        state.sort = state.config.defaults.initialSort;
        resetListingState(state); render(root, state); return;
      }
      if (state.config.layout.loadMoreAction === "dialog" && event.target.closest(".rw-view-all")) {
        event.preventDefault(); openAllReviews(root, state); return;
      }
      const page = event.target.closest('[data-role="pager"] [data-page]');
      if (page) { state.pagerPage = Number(page.dataset.page); render(root, state); return; }
      const qaToggle = event.target.closest('[data-role="qa-submit-toggle"]');
      if (qaToggle) { state.questionForm.expanded = !state.questionForm.expanded; render(root, state); return; }
      const allMedia = event.target.closest('[data-role="feed-all"]');
      if (allMedia) {
        const trigger = root.querySelector('[data-role="player-feed"] [data-media-viewer]');
        if (trigger) openMediaViewer(root, trigger, state);
        return;
      }
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
        if (state.formModalOpen) renderFormModal(root, state);
        else render(root, state);
      }
      const formAgain = event.target.closest('[data-role="form-again"]');
      if (formAgain && root.contains(formAgain)) {
        event.preventDefault();
        state.formDone = false;
        state.formRating = 0;
        clearFormMedia(state);
        state.formDraft = {};
        state.formError = "";
        state.submission.expanded = true;
        if (state.formModalOpen) renderFormModal(root, state);
        else render(root, state);
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
        updateFormControls(starBtn.closest("form"), state);
        return;
      }
      const thumbRemove = event.target.closest('[data-role="form-thumb-remove"]');
      if (thumbRemove && root.contains(thumbRemove)) {
        event.preventDefault();
        const idx = Number(thumbRemove.getAttribute("data-thumb-index"));
        const removed = state.formMedia && state.formMedia.splice(idx, 1)[0];
        if (removed && removed.preview && removed.preview.startsWith("blob:")) URL.revokeObjectURL(removed.preview);
        updateFormControls(thumbRemove.closest("form"), state);
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
          state.viewerPlaying = state.config.layout.video.autoplayInViewer;
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
    root.addEventListener("click", root.__reviewsWidgetMediaClick, { signal });

    root.addEventListener("submit", (event) => {
      const form = event.target.closest('[data-role="submit-form"]');
      const qaForm = event.target.closest('[data-role="qa-submit-form"]');
      if (form || qaForm) {
        event.preventDefault();
        if (form) submitReview(root, state, form);
        else submitQuestion(root, state, qaForm);
      }
    }, { signal });

    root.addEventListener("change", (event) => {
      const input = event.target.closest('[data-role="form-media"]');
      if (!input || !input.files.length) return;
      state.formMedia = state.formMedia || [];
      const cfg = submissionConfig(state);
      const limit = Math.min(state.config.form.maxMedia, Number(cfg.maxFiles) || state.config.form.maxMedia);
      state.formError = "";
      Array.from(input.files).forEach((file) => {
        if (state.formMedia.length >= limit) { state.formError = `Максимум ${limit} файлов`; return; }
        if (cfg.allowedTypes && cfg.allowedTypes.length && !cfg.allowedTypes.includes(file.type)) { state.formError = "Этот тип файла не поддерживается"; return; }
        const maxSize = file.type.startsWith("video/") ? Number(cfg.maxVideoBytes) || 50 * 1024 * 1024 : Number(cfg.maxImageBytes) || 8 * 1024 * 1024;
        if (file.size > maxSize) { state.formError = "Файл превышает допустимый размер"; return; }
        if (cfg.maxTotalBytes && state.formMedia.reduce((total, entry) => total + entry.file.size, file.size) > Number(cfg.maxTotalBytes)) { state.formError = "Превышен общий размер вложений"; return; }
        state.formMedia.push({ file, preview: URL.createObjectURL(file) });
      });
      input.value = "";
      updateFormControls(input.closest("form"), state);
    }, { signal });
    const feedEl = root.querySelector('[data-role="player-feed"]');
    if (feedEl) {
      feedEl.addEventListener("mouseenter", () => {
        if (!state.config.layout.player.autoAdvance.pauseOnHover) return;
        state.feedPaused = true;
        clearFeedTimer(state);
      });
      feedEl.addEventListener("mouseleave", () => {
        state.feedPaused = false;
        scheduleFeedTimer(root, state);
      });
      feedEl.addEventListener("focusin", () => { state.feedPaused = true; clearFeedTimer(state); });
      feedEl.addEventListener("focusout", (event) => {
        if (!feedEl.contains(event.relatedTarget)) { state.feedPaused = false; scheduleFeedTimer(root, state); }
      });
    }


    const loadMoreBtn = root.querySelector('[data-role="load-more"]');
    if (loadMoreBtn) loadMoreBtn.addEventListener("click", () => {
      if (!state.reviewsView && state.config.layout.loadMoreAction === "dialog") {
        openAllReviews(root, state);
      } else if (state.moreError && state.fullFeedSource && !state.fullFeedExhausted) {
        state.fullFeedStalled = false;
        state.moreError = "";
        state.fullFeedSeen.clear();
        if (state.reviewsView) loadAllReviews(root, state);
        else loadMoreReviews(root, state);
      } else if (state.visible < state.filteredReviews.length && (state.reviewsView || state.config.layout.pagination !== "pages" || state.config.layout.mode === "carousel")) {
        state.visible += state.config.layout.pageSize;
        render(root, state);
      } else if (canLoadMore(state)) {
        if (state.reviewsView) loadAllReviews(root, state);
        else loadMoreReviews(root, state);
      }
    });
    const reviewsDialog = root.querySelector('[data-role="all-reviews"]');
    reviewsDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeAllReviews(root, state); });
    reviewsDialog.addEventListener("click", (event) => { if (event.target === reviewsDialog) closeAllReviews(root, state); });
    reviewsDialog.addEventListener("close", () => { if (!reviewsDialog.open) closeAllReviews(root, state); });
    const viewer = root.querySelector('[data-role="media-viewer"]');
    viewer.addEventListener("cancel", (event) => { event.preventDefault(); closeMediaViewer(root, state); });
    viewer.addEventListener("click", (event) => { if (event.target === viewer) closeMediaViewer(root, state); });
    viewer.addEventListener("mouseenter", () => {
      if (state.config.layout.player.autoAdvance.pauseOnHover) { state.viewerHovered = true; clearViewerTimer(root, state); }
    });
    viewer.addEventListener("mouseleave", () => { state.viewerHovered = false; scheduleViewerTimer(root, state); });
    const modal = root.querySelector('[data-role="form-modal"]');
    modal.addEventListener("cancel", (event) => { event.preventDefault(); closeFormModal(root, state); });
    modal.addEventListener("click", (event) => { if (event.target === modal) closeFormModal(root, state); });
    bindCarousel(root, state);
  }

  const reviewsScrollLocks = new WeakMap();

  function openAllReviews(root, state) {
    const dialog = root.querySelector('[data-role="all-reviews"]');
    if (state.destroyed || state.reviewsView || state.activeTab !== "reviews" || !root.isConnected || !dialog) return;
    cancelMoreReviews(state);
    const list = root.querySelector('[data-role="list"]');
    const filters = root.querySelector('[data-section="filters"]');
    const panel = root.querySelector('[data-role="panel-reviews"]');
    const body = dialog.querySelector(".rw-reviews-body");
    const saved = {};
    for (const key of ["chipState", "searchQuery", "sort", "rating", "mediaFilter", "customFiltersOpen", "visible", "pagerPage", "expandedTexts", "carouselOrder", "filteredReviews", "resetScroll", "moreError"]) saved[key] = state[key];
    const view = state.reviewsView = {
      saved, focus: root.getRootNode().activeElement, scrollLeft: list.scrollLeft,
      listRole: list.getAttribute("role"), listTabIndex: list.getAttribute("tabindex"),
      windowScroll: [root.ownerDocument.defaultView.scrollX, root.ownerDocument.defaultView.scrollY],
      nodes: [filters, panel].map((node) => {
        const marker = document.createComment("reviews-view");
        node.before(marker);
        return { node, marker, hidden: node.hidden };
      }),
      content: [root.querySelector('[data-role="chips"]'), list, root.querySelector('[data-role="wall"]'), root.querySelector('[data-role="pager"]')].map((node) => {
        const children = Array.from(node.childNodes);
        children.forEach((child) => child.remove());
        return { node, children, hidden: node.hidden };
      }),
      controls: [root.querySelector('[data-role="load-more"]'), root.querySelector('[data-role="status"]')].map((node) => ({ node, text: node.textContent, hidden: node.hidden, disabled: node.disabled })),
    };
    state.chipState = new Set(state.chipState);
    state.expandedTexts = new Set(state.expandedTexts);
    state.visible = Math.max(12, state.config.layout.pageSize);
    state.pagerPage = 0;
    state.customFiltersOpen = true;
    state.resetScroll = true;
    state.moreError = "";
    body.append(filters, panel);
    filters.hidden = false;
    panel.hidden = false;
    list.removeAttribute("role");
    list.removeAttribute("tabindex");
    root.classList.add("rw-reviews-open");
    clearFeedTimer(state);
    const doc = root.ownerDocument;
    let lock = reviewsScrollLocks.get(doc);
    if (!lock) {
      lock = { count: 0, styles: [doc.documentElement, doc.body].map((node) => ({ node, values: ["overflow", "overflow-x", "overflow-y"].map((name) => [name, node.style.getPropertyValue(name), node.style.getPropertyPriority(name)]) })) };
      reviewsScrollLocks.set(doc, lock);
      lock.styles.forEach(({ node }) => node.style.setProperty("overflow", "hidden", "important"));
    }
    lock.count++;
    view.scrollLock = lock;
    dialog.showModal();
    render(root, state);
    body.scrollTop = 0;
    dialog.querySelector('[data-role="all-reviews-close"]').focus({ preventScroll: true });
    loadAllReviews(root, state);
  }

  function closeAllReviews(root, state) {
    const view = state.reviewsView;
    if (!view) return;
    closeMediaViewer(root, state);
    cancelMoreReviews(state);
    state.reviewsView = null;
    state.carouselPaused = true;
    const dialog = root.querySelector('[data-role="all-reviews"]');
    if (dialog.open) dialog.close();
    Object.assign(state, view.saved);
    const eligible = eligibleReviewPool(state);
    const aggregate = summaryAggregate(eligible, state);
    state.filteredReviews = filterReviewPool(state, eligible);
    view.content.forEach(({ node, children, hidden }) => { node.replaceChildren(...children); node.hidden = hidden; });
    view.controls.forEach(({ node, text, hidden, disabled }) => { node.textContent = text; node.hidden = hidden; if (disabled != null) node.disabled = disabled; });
    view.nodes.forEach(({ node, marker, hidden }) => { marker.replaceWith(node); node.hidden = hidden; });
    root.classList.remove("rw-reviews-open");
    renderSummary(root, eligible, aggregate, state);
    renderDistribution(root, aggregate, state);
    renderResults(root, aggregate, state.filteredReviews.length, state);
    renderListStatus(root, aggregate, state.filteredReviews.length, state);
    const list = root.querySelector('[data-role="list"]');
    if (view.listRole != null) list.setAttribute("role", view.listRole);
    if (view.listTabIndex != null) list.setAttribute("tabindex", view.listTabIndex);
    list.scrollLeft = view.scrollLeft;
    if (--view.scrollLock.count === 0) {
      view.scrollLock.styles.forEach(({ node, values }) => {
        node.style.removeProperty("overflow");
        values.forEach(([name, value, priority]) => { if (value) node.style.setProperty(name, value, priority); });
      });
      reviewsScrollLocks.delete(root.ownerDocument);
    }
    root.ownerDocument.defaultView.scrollTo({ left: view.windowScroll[0], top: view.windowScroll[1], behavior: "instant" });
    if (!state.destroyed) {
      if (state.refreshCarousel) state.refreshCarousel(false);
      if (view.focus?.isConnected) view.focus.focus({ preventScroll: true });
      scheduleFeedTimer(root, state);
    }
  }

  async function loadAllReviews(root, state) {
    const view = state.reviewsView;
    if (!view || view.scanning || state.loading) return;
    const scan = {};
    view.scanning = scan;
    while (state.reviewsView === view && view.scanning === scan && root.isConnected && canLoadMore(state) && !state.moreError && !root.querySelector('[data-role="media-viewer"]').open) {
      if (!await loadMoreReviews(root, state)) break;
    }
    if (view.scanning === scan) view.scanning = null;
  }

  function bindCarousel(root, state) {
    if (state.config.layout.mode !== "carousel") return;
    const list = root.querySelector('[data-role="list"]');
    const nav = root.querySelector('[data-role="carousel-nav"]');
    const previous = nav.querySelector('[data-role="carousel-prev"]');
    const next = nav.querySelector('[data-role="carousel-next"]');
    const view = root.ownerDocument.defaultView;
    const signal = state.controller.signal;
    const reducedMotion = view.matchMedia("(prefers-reduced-motion: reduce)");
    let queued = false;
    const reveal = () => {
      if (state.destroyed || signal.aborted || state.carouselPaused || state.reviewsView || state.activeTab !== "reviews" || !root.isConnected) return;
      const remaining = list.scrollWidth - list.clientWidth - Math.abs(list.scrollLeft);
      if (!list.clientWidth || remaining > list.clientWidth) return;
      if (state.visible < state.filteredReviews.length) {
        state.visible += Math.max(state.config.layout.pageSize, Math.ceil(list.clientWidth / Math.max(1, list.firstElementChild?.getBoundingClientRect().width || list.clientWidth)));
        render(root, state);
      } else if (canLoadMore(state) && !state.moreError) loadMoreReviews(root, state);
    };
    const refresh = (load = true) => {
      if (state.destroyed) return;
      const max = Math.max(0, list.scrollWidth - list.clientWidth);
      const position = Math.min(max, Math.abs(list.scrollLeft));
      const more = state.visible < state.filteredReviews.length || canLoadMore(state);
      nav.hidden = state.activeTab !== "reviews" || Boolean(state.reviewsView);
      previous.disabled = nav.hidden || position <= 1;
      next.disabled = nav.hidden || (max - position <= 1 && !more);
      if (load && !queued && !nav.hidden && !state.loading && !state.loadingMore) {
        queued = true;
        queueMicrotask(() => { queued = false; reveal(); });
      }
    };
    const scroll = async (direction) => {
      state.carouselPaused = false;
      if (direction > 0 && list.scrollWidth - list.clientWidth - Math.abs(list.scrollLeft) <= 1) {
        if (state.visible < state.filteredReviews.length) {
          state.visible += state.config.layout.pageSize; render(root, state);
        } else if (canLoadMore(state)) await loadMoreReviews(root, state);
      }
      if (state.destroyed || signal.aborted || state.reviewsView || !root.isConnected) return;
      const card = list.firstElementChild;
      if (!card) return;
      const style = view.getComputedStyle(list);
      const step = card.getBoundingClientRect().width + (parseFloat(style.columnGap) || 0);
      list.scrollBy({ left: direction * step * (style.direction === "rtl" ? -1 : 1), behavior: reducedMotion.matches ? "instant" : "smooth" });
      refresh();
    };
    previous.addEventListener("click", () => scroll(-1), { signal });
    next.addEventListener("click", () => scroll(1), { signal });
    for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) list.addEventListener(event, () => { state.carouselPaused = false; refresh(); }, { passive: true, signal });
    list.addEventListener("scroll", () => refresh(), { passive: true, signal });
    view.addEventListener("resize", () => refresh(), { signal });
    const observer = view.ResizeObserver ? new view.ResizeObserver(() => refresh()) : null;
    if (observer) observer.observe(list);
    state.refreshCarousel = refresh;
    signal.addEventListener("abort", () => {
      if (observer) observer.disconnect();
      state.refreshCarousel = null;
    }, { once: true });
  }
  function eligibleReviewPool(state) {
    return state.reviews.filter((review) => matchesDefaults(review, state.config.defaults));
  }

  function filterReviewPool(state, reviews = eligibleReviewPool(state)) {
    const query = String(state.searchQuery || "").trim().toLowerCase();
    return sortReviews(chipsFilter(reviews, state).filter((review) => {
      const ratingOk = ratingMatches(review.rating, state.rating);
      const mediaOk = mediaMatches(review, state.mediaFilter);
      const layoutOk = state.reviewsView || state.config.layout.mode !== "video" || (state.config.visibility.photos && review.media.some((item) => item.kind === "video"));
      const searchOk = !query || `${review.title || ""} ${review.text || ""} ${review.pros || ""} ${review.cons || ""}`.toLowerCase().includes(query);
      return ratingOk && mediaOk && searchOk && layoutOk;
    }), state.sort, state.config);
  }


  function render(root, state) {
    if (state.destroyed) return;
    const focused = root.getRootNode().activeElement;
    const focusKey = focused && root.contains(focused) ? { chip: focused.dataset.chip, rating: focused.dataset.rating, review: focused.dataset.reviewKey, page: focused.dataset.page, role: focused.dataset.role, name: focused.name, label: focused.getAttribute("aria-label") } : null;
    root.classList.toggle("rw-is-expanded", state.expanded);
    const list = root.querySelector('[data-role="list"]');
    const body = root.querySelector(".rw-reviews-body");
    const scrollLeft = state.resetScroll ? 0 : list.scrollLeft;
    const scrollTop = state.resetScroll ? 0 : body.scrollTop;
    state.resetScroll = false;

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
      writeCta.hidden = !canSubmit(state) || state.activeTab !== "reviews" || state.config.layout.sections.includes("summary") || state.config.form.ctaMode === "section";
    }
    const headCta = root.querySelector('[data-role="head-cta"]');
    if (headCta) headCta.hidden = !canSubmit(state);
    if (writeCta && !writeCta.hidden) {
      if (tabsRow) tabsRow.hidden = false;
      if (headerRow) headerRow.hidden = false;
    }
    // The overview, media strip and filter bar describe reviews only — hide them
    // on the questions tab so they don't imply the ratings/filters apply there.
    root.classList.toggle("rw-showing-questions", state.activeTab === "questions");

    const panelReviews = root.querySelector('[data-role="panel-reviews"]');
    const panelQuestions = root.querySelector('[data-role="panel-questions"]');
    if (panelReviews) panelReviews.hidden = state.activeTab !== "reviews";
    if (panelQuestions) panelQuestions.hidden = state.activeTab !== "questions";
    const eligible = eligibleReviewPool(state);
    const aggregate = summaryAggregate(eligible, state);
    let filtered = filterReviewPool(state, eligible);
    if (!state.reviewsView) {
      renderSummary(root, eligible, aggregate, state);
      renderDistribution(root, aggregate, state);
    }
    renderResults(root, aggregate, filtered.length, state);

    if (state.activeTab === "questions") {
      clearFeedTimer(state);
      renderQuestionsPanel(root, state);
      if (state.refreshCarousel) state.refreshCarousel();
      return;
    }

    if (state.loading || state.error) {
      if (!state.reviewsView) {
        renderPlayerFeed(root, state);
        renderMediaStrip(root, state, state.config);
        renderWall(root, eligible, state.config);
      }
      renderSegments(root, state, eligible, aggregate);
      renderList(root, [], state);
      renderStatus(root, state.loading ? "Загружаем отзывы" : state.error, true);
      root.querySelector('[data-role="load-more"]').hidden = true;
      renderSubmission(root, state);
      if (state.refreshCarousel) state.refreshCarousel();
      return;
    }

    const carousel = !state.reviewsView && state.config.layout.mode === "carousel";
    if (carousel) {
      if (state.carouselOrder) {
        const remaining = new Set(filtered);
        const ordered = [];
        state.carouselOrder.forEach((review) => { if (remaining.delete(review)) ordered.push(review); });
        filtered = ordered.concat(Array.from(remaining));
      }
      state.carouselOrder = filtered;
    }
    state.filteredReviews = filtered;
    const pages = !state.reviewsView && !carousel && state.config.layout.pagination === "pages"
      ? Math.max(1, Math.ceil(filtered.length / state.config.layout.pageSize))
      : 0;
    if (pages && state.pagerPage >= pages) state.pagerPage = 0;
    const visibleCount = pages
      ? filtered.slice(state.pagerPage * state.config.layout.pageSize, (state.pagerPage + 1) * state.config.layout.pageSize).length
      : effectiveVisibleCount(state, filtered.length);

    if (!state.reviewsView) {
      renderPlayerFeed(root, state);
      renderMediaStrip(root, state, state.config);
    }
    renderSegments(root, state, eligible, aggregate);
    const pageReviews = pages
      ? filtered.slice(state.pagerPage * state.config.layout.pageSize, (state.pagerPage + 1) * state.config.layout.pageSize)
      : filtered.slice(0, visibleCount);
    if (!state.reviewsView) renderWall(root, pageReviews, state.config);
    else root.querySelector('[data-role="wall"]').hidden = true;
    renderList(root, pageReviews, state);
    list.scrollLeft = scrollLeft;
    body.scrollTop = scrollTop;

    const incomplete = !aggregate.complete;
    renderListStatus(root, aggregate, filtered.length, state);
    const loadMore = root.querySelector('[data-role="load-more"]');
    const pager = root.querySelector('[data-role="pager"]');
    if (pages) renderPager(root, state, filtered.length, pages);
    else if (pager) pager.hidden = true;
    if (loadMore) {
      const opensDialog = !state.reviewsView && state.config.layout.loadMoreAction === "dialog";
      const localMore = !pages && visibleCount < filtered.length;
      const remoteMore = Boolean(state.fullFeedSource && !state.fullFeedExhausted);
      loadMore.hidden = opensDialog ? !eligible.length && !incomplete : !localMore && !(remoteMore && (!pages || state.pagerPage === pages - 1));
      loadMore.disabled = !opensDialog && !localMore && state.loadingMore;
      loadMore.textContent = opensDialog ? "Смотреть все отзывы" : state.moreError ? "Повторить загрузку" : localMore ? "Показать ещё" : state.loadingMore ? "Загружаем" : pages ? "Загрузить ещё отзывы" : "Показать ещё";
    }
    if (!state.reviewsView) renderSubmission(root, state);
    if (state.refreshCarousel) state.refreshCarousel();
    if (focusKey && !focused.isConnected) {
      const candidates = root.querySelectorAll("button, input, select, textarea");
      const next = Array.from(candidates).find((node) => focusKey.review != null ? node.dataset.reviewKey === focusKey.review && node.dataset.role === focusKey.role : focusKey.rating != null ? node.dataset.rating === focusKey.rating : focusKey.chip != null ? node.dataset.chip === focusKey.chip : focusKey.page != null ? node.dataset.page === focusKey.page : focusKey.name ? node.name === focusKey.name : focusKey.role ? node.dataset.role === focusKey.role : focusKey.label && node.getAttribute("aria-label") === focusKey.label);
      if (next && !next.disabled && !next.closest("[hidden]")) next.focus({ preventScroll: true });
    }
    if (state.reviewsView && !state.loadingMore && !state.moreError) loadAllReviews(root, state);
  }

  function totalReviewsLabel(aggregate) {
    return `${aggregate.complete ? "Всего" : "Загружено"} ${pluralize(aggregate.totalReviews, "отзыв", "отзыва", "отзывов")}`;
  }

  function renderResults(root, aggregate, found, state) {
    const status = state.loading ? "Загружаем отзывы…" : state.error ? "Не удалось загрузить отзывы" : `Найдено ${pluralize(found, "отзыв", "отзыва", "отзывов")}${aggregate.complete ? "" : " среди загруженных"}`;
    const text = `${totalReviewsLabel(aggregate)} · ${status}${state.loadingMore ? " · загружаем остальные…" : ""}`;
    root.querySelectorAll('[data-role="results-count"], [data-role="list-results"]').forEach((node) => { node.textContent = text; });
  }

  function renderListStatus(root, aggregate, found, state) {
    const empty = aggregate.complete ? "Отзывов с такими фильтрами нет" : `Среди загруженных отзывов совпадений нет.${state.fullFeedSource ? " Поиск продолжится после загрузки остальных." : " Загружены не все отзывы."}`;
    renderStatus(root, state.loading ? "Загружаем отзывы" : state.error || state.moreError || empty, state.loading || Boolean(state.error) || found === 0 || Boolean(state.moreError));
  }

  function renderStatus(root, text, visible) {
    const status = root.querySelector('[data-role="status"]');
    if (!status) return;
    status.textContent = text;
    status.hidden = !visible;
  }
  /* ===== Плеер-лента (секция player) ===== */
  const FEED_AR = { "9:16": "9 / 16", "3:4": "3 / 4", "1:1": "1 / 1" };
  function mediaItems(root, state) {
    const panel = productPanelState(root, state.config);
    const reviews = state.reviews.flatMap((review) => review.media.map((raw) => decorateItemForPanel(absolutizeUserMedia(raw, root.__reviewsProxyBase), review, panel)));
    if (!state.feed) return reviews;
    const byURL = new Map(reviews.map((item) => [item.url, item]));
    const feed = state.feed.filter((item) => item && item.url && !marketplacePolicyFor(item.marketplace, state.config).hidden).map((raw) => {
      const item = absolutizeUserMedia(raw, root.__reviewsProxyBase);
      const owner = byURL.get(item.url);
      const policy = marketplacePolicyFor(item.marketplace, state.config);
      return owner ? { ...owner, ...item, review: owner.review, duration: formatMediaDuration(item.duration) || owner.duration } : {
        ...item, duration: formatMediaDuration(item.duration), marketplaceLabel: policy.label || item.marketplaceLabel,
        productUrl: policy.showSourceLinks === false ? "" : item.productUrl,
        review: { authorName: item.authorName || "Покупатель", marketplace: item.marketplace, createdAt: item.createdAt, rating: item.rating || 0 },
      };
    });
    const seen = new Set(feed.map((item) => item.url));
    return feed.concat(reviews.filter((item) => !seen.has(item.url)));
  }
  function renderPlayerFeed(root, state) {
    const el = root.querySelector('[data-role="player-feed"]');
    if (!el) return;
    const cfg = state.config.layout.player;
    const show = state.config.layout.sections.includes("player") && cfg.enabled !== false && state.activeTab === "reviews";
    el.hidden = !show;
    if (!show) {
      clearFeedTimer(state);
      el.innerHTML = "";
      return;
    }
    const feedItems = mediaItems(root, state);
    if (!feedItems.length) {
      el.hidden = true;
      clearFeedTimer(state);
      el.innerHTML = "";
      return;
    }
    const proxyBase = root.__reviewsProxyBase || "";
    if (state.feedIndex < 0) state.feedIndex = feedItems.findIndex((item) => item.kind === "video");
    const tiles = feedItems.slice(0, 18).map((item, index) => {
      const author = item.authorName || "Покупатель";
      const src = item.kind === "video" ? item.previewUrl : mediaProxyURL(item.url, proxyBase);
      const dur = item.duration ? `<span class="rw-tile-dur">${escapeHTML(item.duration)}</span>` : "";
      const badge = cfg.showSourceBadge && state.config.visibility.marketplaceBadges && item.marketplace
        ? `<span class="rw-tile-badge">${renderMarketplaceLabel(item.marketplace, state.config, item.marketplaceLabel)}</span>` : "";
      const who = cfg.showAuthor
        ? `<span class="rw-tile-who"><span class="rw-tile-av">${escapeHTML(initials(author))}</span>${escapeHTML(author)}</span>` : "";
      const likes = cfg.showLikes && item.likes
        ? `<span class="rw-tile-like"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3 4.9 13a4.6 4.6 0 0 1 0-6.4 4.3 4.3 0 0 1 6.2 0l.9 1 .9-1a4.3 4.3 0 0 1 6.2 0 4.6 4.6 0 0 1 0 6.4Z"/></svg>${escapeHTML(String(item.likes))}</span>` : "";
      const active = cfg.autoAdvance.enabled && item.kind === "video" && index === state.feedIndex;
      const mediaAttrs = mediaTriggerAttributes(item, `${item.kind === "video" ? "Видео" : "Фото"} отзыва, ${author}`, Boolean(item.productUrl));
      return `<button type="button" class="rw-feed-tile${active ? " is-playing" : ""}" ${mediaAttrs} aria-label="Открыть медиа · ${escapeAttribute(author)}">
        ${src ? `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(`Медиа отзыва · ${author}`)}" loading="lazy" />` : ""}
        <span class="rw-tile-grad" aria-hidden="true"></span>
        ${item.kind === "video" ? `<span class="rw-tile-play" aria-hidden="true"><i></i></span>${dur}` : ""}${badge}${who}${likes}
        ${active ? `<span class="rw-tile-prog" aria-hidden="true"><i></i></span><span class="rw-tile-ring" aria-hidden="true"></span>` : ""}
      </button>`;
    }).join("");
    // Макет fhead: «N видео · N фото» + «Смотреть все» справа.
    const vids = feedItems.filter((item) => item.kind === "video").length;
    const photos = feedItems.length - vids;
    const viewAll = cfg.showViewAll === false ? "" : `<button class="rw-feed-all" type="button" data-role="feed-all">${escapeHTML(state.config.labels.viewAll || defaultConfig.labels.viewAll)}</button>`;
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
    el.style.setProperty("--rw-adv-dur", `${cfg.autoAdvance.intervalSec}s`);
    scheduleFeedTimer(root, state);
  }
  function clearFeedTimer(state) {
    if (state.feedTimer) { clearTimeout(state.feedTimer); state.feedTimer = null; }
  }
  function scheduleFeedTimer(root, state) {
    clearFeedTimer(state);
    const cfg = state.config.layout.player;
    if (state.destroyed || state.reviewsView || !cfg.enabled || !cfg.autoAdvance.enabled || state.feedPaused || state.activeTab !== "reviews" || !state.config.layout.sections.includes("player")) return;
    const viewer = root.querySelector('[data-role="media-viewer"]');
    if (viewer && viewer.open) return;
    const tiles = Array.from(root.querySelectorAll('[data-role="player-feed"] .rw-feed-tile'));
    const videos = tiles.map((tile, index) => tile.dataset.mediaKind === "video" ? index : -1).filter((index) => index >= 0);
    if (!videos.length) return;
    state.feedTimer = setTimeout(() => {
      if (!root.isConnected) { root.__reviewsWidget?.destroy(); return; }
      state.feedTimer = null;
      state.feedIndex = videos[(videos.indexOf(state.feedIndex) + 1) % videos.length];
      tiles.forEach((tile, index) => {
        const active = index === state.feedIndex;
        tile.classList.toggle("is-playing", active);
        tile.querySelectorAll(".rw-tile-prog, .rw-tile-ring").forEach((node) => node.remove());
        if (active) tile.insertAdjacentHTML("beforeend", '<span class="rw-tile-prog" aria-hidden="true"><i></i></span><span class="rw-tile-ring" aria-hidden="true"></span>');
      });
      const row = tiles[state.feedIndex].parentElement;
      row.scrollTo({ left: tiles[state.feedIndex].offsetLeft - row.offsetLeft, behavior: "smooth" });
      scheduleFeedTimer(root, state);
    }, cfg.autoAdvance.intervalSec * 1000);
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
  function renderMediaSet(review, config, proxyBase, panel) {
    const media = review.media;
    if (!config.visibility.photos || !media.length) {
      return "";
    }
    const mc = config.layout.mediacard;
    const lim = mc.layout === "one" ? 1 : Math.min(media.length, mc.maxTiles);
    const rest = media.length - lim;
    const tiles = media.slice(0, lim).map((raw, index) => {
      const item = decorateItemForPanel(absolutizeUserMedia(raw, proxyBase), review, panel);
      const src = item.kind === "video" ? item.previewUrl : mediaProxyURL(item.url, proxyBase);
      const caption = item.kind === "video" ? "Видео отзыва" : "Фото отзыва";
      const last = index === lim - 1;
      const plus = last && rest > 0 && mc.plusMore ? `<span class="rw-mt-more">+${rest}</span>` : "";
      const dur = item.kind === "video" && item.duration && mc.videoBadge ? `<span class="rw-mt-dur">${escapeHTML(item.duration)}</span>` : "";
      const play = item.kind === "video" ? `<span class="rw-mt-play" aria-hidden="true"><i></i></span>` : "";
      const target = plus ? decorateItemForPanel(absolutizeUserMedia(media[lim], proxyBase), review, panel) : item;
      return `<button type="button" class="rw-mt" ${mediaTriggerAttributes(target, caption, Boolean(panel))} aria-label="${escapeAttribute(plus ? `Ещё ${rest} медиа` : caption)}">
        ${src ? `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(caption)}" loading="lazy">` : ""}${play}${dur}${plus}
      </button>`;
    }).join("");
    return `<div class="rw-media-set rw-mc-${escapeAttribute(mc.layout)}">${tiles}</div>`;
  }

  function renderSummary(root, all, aggregate, state) {
    const scoreEl = root.querySelector('[data-role="score"]');
    const total = aggregate.totalReviews;
    const average = aggregate.averageRating;
    const qualifier = aggregate.complete ? "" : " среди загруженных";
    if (scoreEl) {
      scoreEl.textContent = formatScore(average);
      scoreEl.title = aggregate.ratingCount ? `Средняя оценка${qualifier}` : `Нет оценок${qualifier}`;
    }
    const stars = root.querySelector('[data-role="stars"]');
    const countEl = root.querySelector('[data-role="review-count"]');
    const summaryEl = root.querySelector('[data-role="summary"]');
    if (stars) {
      stars.setAttribute("aria-label", aggregate.ratingCount ? `Средняя оценка ${formatScore(average)}${qualifier}` : `Нет оценок${qualifier}`);
      if (stars.closest(".rw-head")) {
        // Макет: глифы «★★★★★» с затемнённым остатком (w-stars .dim).
        const full = Math.max(0, Math.min(5, Math.round(average)));
        stars.innerHTML = "★".repeat(full) + (full < 5 ? `<span class="rw-dim">${"★".repeat(5 - full)}</span>` : "");
      } else {
        stars.style.setProperty("--rating", Number.isFinite(average) ? average.toFixed(2) : "0");
      }
    }
    if (countEl) {
      countEl.textContent = aggregate.complete ? String(total) : `Загружено ${total}`;
      countEl.setAttribute("aria-label", totalReviewsLabel(aggregate));
    }
    if (summaryEl) summaryEl.textContent = totalReviewsLabel(aggregate);
    const recommend = root.querySelector('[data-role="recommend"]');
    if (recommend) {
      recommend.hidden = !Number.isFinite(aggregate.recommendPercent);
      recommend.textContent = Number.isFinite(aggregate.recommendPercent) ? `${Math.round(aggregate.recommendPercent)}% оценок — 4 и 5 звёзд${qualifier}` : "";
    }
    const customSummary = root.querySelector('[data-role="custom-summary"]');
    if (customSummary) {
      customSummary.innerHTML = state.config.customFields.filter((field) => field.showInSummary).map((field) => {
        const counts = new Map();
        all.forEach((review) => { const value = reviewCustomValue(review, field.id); if (value) counts.set(value, (counts.get(value) || 0) + 1); });
        return Array.from(counts).map(([value, count]) => `<span class="rw-attr">${escapeHTML(field.label)} ${escapeHTML(value)} · ${count}${qualifier}</span>`).join("");
      }).join("");
      customSummary.hidden = !customSummary.childElementCount;
    }
  }
  // «4,7» — запятая, как в макете (ru-RU формат без следящего нуля).
  function formatScore(average) {
    return Number.isFinite(average) ? average.toFixed(1).replace(".", ",") : "—";
  }

  function reviewCustomValue(review, id) {
    const custom = review.custom || {};
    const value = custom[id];
    return typeof value === "string" ? value.trim() : value == null ? "" : String(value);
  }
  function filterChipAllowed(state, id, value) {
    if (id === "rating") return ["1", "2", "3", "4", "5"].includes(value) && !(Number(value) < state.config.defaults.minRating);
    if (id === "marketplace") return Boolean(value) && !marketplacePolicyFor(value, state.config).hidden && (state.config.defaults.marketplace === "all" || value === state.config.defaults.marketplace);
    if (id === "media") return state.config.visibility.photos && ["photo", "video"].includes(value);
    const field = state.config.customFields.find((item) => `custom:${encodeURIComponent(item.id)}` === id && item.filterable);
    return Boolean(field && (!field.options.length || field.options.includes(value)));
  }

  function toggleFilterChip(root, state, id, value) {
    if (!filterChipAllowed(state, id, value)) return;
    const key = `${id}:${value}`;
    const selected = state.chipState.has(key);
    if (!state.config.filters.multiSelect) for (const entry of state.chipState) if (entry.startsWith(`${id}:`)) state.chipState.delete(entry);
    if (selected) state.chipState.delete(key); else state.chipState.add(key);
    resetListingState(state);
    render(root, state);
  }

  // Макет w-chips: один ряд пилюль «Все · С фото · 5★ · площадки · настраиваемые
  // поля». Мультиселект: клик добавляет/снимает чип, «Все» сбрасывает.
  function renderSegments(root, state, reviews, aggregate) {
    const chipsRoot = root.querySelector('[data-role="chips"]');
    if (!chipsRoot) return;
    const cfg = state.config.filters;
    const section = chipsRoot.parentElement;
    section.className = `rw-chips rw-filters-${cfg.layout}`;
    const groups = [
      { id: "media", label: "Медиа", options: [["photo", "С фото"], ["video", "С видео"]] },
      { id: "rating", label: "Оценка", options: [5, 4, 3, 2, 1].map((n) => [String(n), `${n}★`]) },
      { id: "marketplace", label: "Площадка", options: unique(reviews.map((review) => review.marketplace)).map((value) => [value, labelMarketplaceValue(value, reviews)]) },
      ...state.config.customFields.filter((field) => field.filterable).map((field) => ({
        id: `custom:${encodeURIComponent(field.id)}`, label: field.label,
        options: (field.options.length ? field.options : unique(reviews.map((review) => reviewCustomValue(review, field.id))))
          .filter((value) => !cfg.hideRare || !aggregate.complete || state.chipState.has(`custom:${encodeURIComponent(field.id)}:${value}`) || reviews.filter((review) => reviewCustomValue(review, field.id) === value).length > 1)
          .map((value) => [value, value]),
      })),
    ].map((group) => ({ ...group, options: group.options.filter(([value]) => filterChipAllowed(state, group.id, value)) })).filter((group) => group.options.length);
    chipsRoot.innerHTML = "";
    const toolbar = document.createElement("div");
    toolbar.className = "rw-filter-bar";
    toolbar.innerHTML = `<input class="rw-search" type="search" data-role="search" placeholder="${escapeAttribute(state.config.labels.search)}" aria-label="${escapeAttribute(state.config.labels.search)}" value="${escapeAttribute(state.searchQuery)}"><select class="rw-sort" data-role="sort" aria-label="Сортировка отзывов">${[["relevance", "По полезности"], ["newest", "Сначала новые"], ["highest", "Высокая оценка"], ["lowest", "Низкая оценка"], ["media", "Сначала с медиа"]].map(([value, label]) => `<option value="${value}"${state.sort === value ? " selected" : ""}>${label}</option>`).join("")}</select>`;
    toolbar.querySelector("input").addEventListener("input", (event) => {
      const position = event.target.selectionStart;
      state.searchQuery = event.target.value;
      resetListingState(state);
      render(root, state);
      const search = root.querySelector('[data-role="search"]');
      search.focus({ preventScroll: true });
      search.setSelectionRange(position, position);
    });
    toolbar.querySelector("select").addEventListener("change", (event) => { state.sort = event.target.value; resetListingState(state); render(root, state); });
    chipsRoot.appendChild(toolbar);
    const body = document.createElement("div");
    const base = document.createElement("div");
    base.className = "rw-filter-base";
    body.className = "rw-filters-body";
    if (cfg.collapsible) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "rw-filters-toggle";
      toggle.textContent = state.customFiltersOpen ? "Скрыть фильтры" : `Фильтры${state.chipState.size ? ` (${state.chipState.size})` : ""}`;
      toggle.setAttribute("aria-expanded", String(state.customFiltersOpen));
      body.hidden = !state.customFiltersOpen;
      toggle.addEventListener("click", () => {
        state.customFiltersOpen = !state.customFiltersOpen;
        body.hidden = !state.customFiltersOpen;
        toggle.setAttribute("aria-expanded", String(state.customFiltersOpen));
        toggle.textContent = state.customFiltersOpen ? "Скрыть фильтры" : "Фильтры";
      });
      chipsRoot.appendChild(toggle);
    }
    const reset = segmentButton("Все", !state.chipState.size, () => { state.chipState.clear(); resetListingState(state); render(root, state); });
    reset.className = `rw-chip${state.chipState.size ? "" : " on"}`;
    reset.dataset.chip = "all";
    base.appendChild(reset);
    body.appendChild(base);
    groups.forEach((group) => {
      const wrapper = document.createElement("div");
      wrapper.className = "rw-filter-group";
      const label = document.createElement("span");
      label.className = "rw-filter-label";
      label.textContent = group.label;
      const custom = group.id.startsWith("custom:");
      if (custom && cfg.layout === "dropdowns") wrapper.appendChild(label);
      if (cfg.layout === "dropdowns" && custom) {
        const select = document.createElement("select");
        select.className = "rw-filter-select";
        select.multiple = cfg.multiSelect;
        select.setAttribute("aria-label", group.label);
        select.innerHTML = `<option value="">${cfg.labelMode === "all" ? `${escapeHTML(group.label)}: все` : escapeHTML(group.label)}</option>${group.options.map(([value, text]) => `<option value="${escapeAttribute(value)}"${state.chipState.has(`${group.id}:${value}`) ? " selected" : ""}>${escapeHTML(text)}</option>`).join("")}`;
        if (cfg.multiSelect) select.options[0].selected = false;
        select.addEventListener("change", () => {
          const values = Array.from(select.selectedOptions).map((option) => option.value);
          for (const value of state.chipState) if (value.startsWith(`${group.id}:`)) state.chipState.delete(value);
          if (!values.includes("")) values.forEach((value) => state.chipState.add(`${group.id}:${value}`));
          resetListingState(state); render(root, state);
        });
        wrapper.appendChild(select);
      } else {
        const row = document.createElement("div");
        row.className = "rw-filter-chips";
        if (custom && cfg.layout === "rows") {
          const groupReset = segmentButton(cfg.labelMode === "plain" ? group.label : `Все: ${group.label}`, !Array.from(state.chipState).some((value) => value.startsWith(`${group.id}:`)), () => {
            for (const value of state.chipState) if (value.startsWith(`${group.id}:`)) state.chipState.delete(value);
            resetListingState(state); render(root, state);
          });
          groupReset.className = "rw-chip rw-filter-chip";
          row.appendChild(groupReset);
        }
        group.options.forEach(([value, text]) => {
          const key = `${group.id}:${value}`;
          const selected = state.chipState.has(key);
          const title = cfg.layout === "chips" && cfg.labelMode === "all" && group.id.startsWith("custom:") ? `${group.label}: ${text}` : text;
          const button = segmentButton(title, selected, () => toggleFilterChip(root, state, group.id, value));
          button.className = `rw-chip rw-filter-chip${selected ? " on" : ""}`;
          button.dataset.chip = key;
          if (group.id === "marketplace") {
            button.innerHTML = renderMarketplaceLabel(value, state.config, text);
            button.setAttribute("aria-label", title);
            button.title = title;
          }
          row.appendChild(button);
        });
        wrapper.appendChild(row);
      }
      (custom ? body : base).appendChild(wrapper);
    });
    chipsRoot.appendChild(body);
  }
  function chipsFilter(reviews, state) {
    if (!state.chipState.size) return reviews;
    const groups = new Map();
    const groupIDs = new Set();
    for (const entry of state.chipState) {
      const split = entry.startsWith("custom:") ? entry.indexOf(":", 7) : entry.indexOf(":");
      const id = entry.slice(0, split), value = entry.slice(split + 1);
      if (!filterChipAllowed(state, id, value) || (!state.config.filters.multiSelect && groupIDs.has(id))) {
        state.chipState.delete(entry);
        continue;
      }
      groupIDs.add(id);
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(value);
    }
    const selections = Array.from(groups);
    return reviews.filter((review) => selections.every(([id, values]) => values.some((value) => {
      if (id === "media") return mediaMatches(review, value);
      if (id === "rating") return ratingMatches(review.rating, value);
      if (id === "marketplace") return review.marketplace === value;
      return reviewCustomValue(review, decodeURIComponent(id.slice(7))) === value;
    })));
  }



  function renderDistribution(root, aggregate, state) {
    const distRoot = root.querySelector('[data-role="distwrap"]');
    if (!distRoot) return;
    const qualifier = aggregate.complete ? "" : " среди загруженных";
    distRoot.setAttribute("aria-label", `Распределение оценок${qualifier}`);
    distRoot.innerHTML = [5, 4, 3, 2, 1].map((rating) => {
      const count = aggregate.distribution[rating];
      const percent = aggregate.ratingCount ? count / aggregate.ratingCount * 100 : 0;
      const allowed = filterChipAllowed(state, "rating", String(rating));
      const disabled = !allowed || (aggregate.complete && count === 0);
      const reason = !allowed ? "; оценка недоступна по настройкам магазина" : disabled ? "; отзывов с такой оценкой нет" : "";
      const label = `${pluralize(rating, "звезда", "звезды", "звёзд")}: ${pluralize(count, "отзыв", "отзыва", "отзывов")}${qualifier}${reason}`;
      return `<button type="button" class="rw-dist-row" data-rating="${rating}" aria-pressed="${state.chipState.has(`rating:${rating}`)}" aria-label="${escapeAttribute(label)}" title="${escapeAttribute(label)}"${disabled ? " disabled" : ""}><span class="rw-dl">${rating}★</span><span class="rw-db"><i style="width:${percent}%"></i></span><span class="rw-dist-count">${count}${aggregate.complete ? "" : " загр."}</span></button>`;
    }).join("");
  }

  function renderMediaStrip(root, state, config) {
    const mediaRoot = root.querySelector('[data-role="media-strip"]');
    if (!mediaRoot) return;
    const panel = productPanelState(root, config);
    const media = mediaItems(root, state);
    // Макет (04-editor w-media): один ряд квадратов 96px, видео — play-иконка
    // снизу-справа (splay 20px) и длительность снизу-слева (sdur 9px). Без
    // заголовка «Фото покупателей» и без сплит-рельс: вся медиа одной лентой.
    const stileHTML = (item) => {
      const src = item.kind === "video" ? item.previewUrl : mediaProxyURL(item.url, root.__reviewsProxyBase);
      const caption = item.kind === "video" ? `Видео отзыва, ${item.authorName}` : `Фото отзыва, ${item.authorName}`;
      const play = item.kind === "video"
        ? `<span class="rw-splay"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg></span><span class="rw-sdur">${escapeHTML(item.duration || "")}</span>`
        : "";
      return `<button type="button" class="rw-stile" ${mediaTriggerAttributes(item, caption, Boolean(panel))}>
        ${src ? `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(caption)}" loading="lazy">` : ""}${play}
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
        <span class="rw-wall-count">${items.length} медиа</span>
        ${viewAllHref ? config.layout.loadMoreAction === "dialog" ? '<button class="rw-view-all" type="button">Смотреть все отзывы</button>' : `<a class="rw-view-all" href="${escapeAttribute(viewAllHref)}" target="_blank" rel="noreferrer">${escapeHTML(config.labels.viewAll)}</a>` : ""}
      </div><div class="rw-wall">
        ${items
          .slice(0, config.layout.wall.maxTiles)
          .map((item) => {
            const src = item.kind === "video" ? item.previewUrl : mediaProxyURL(item.url, root.__reviewsProxyBase);
            const caption = item.kind === "video" ? `Видео отзыва, ${item.authorName}` : `Фото отзыва, ${item.authorName}`;
            const hoverMarkup = config.layout.tileHover !== false
              ? `<span class="rw-tile-hover"><span class="rw-stars" style="--rating: ${item.rating || 0}"></span><span>${escapeHTML(item.authorName || "Покупатель")}</span><span class="rw-tile-label">Смотреть</span></span>`
              : "";
            return `
              <a class="rw-wall-tile${item.kind === "video" ? " is-video" : ""}" href="${escapeAttribute(safeSourceURL(item.url) || "#")}" ${mediaTriggerAttributes(item, caption, Boolean(panel))}>
                ${src ? `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(caption)}" loading="lazy" />` : ""}
                ${item.kind === "video" ? '<span class="rw-play-badge"></span>' : ""}
                ${item.kind === "video" && config.visibility.marketplaceBadges && config.layout.video.showSourceBadge && item.marketplace ? `<span class="rw-video-card-src">${renderMarketplaceLabel(item.marketplace, config, item.marketplaceLabel)}</span>` : ""}
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
    const config = state.config;
    if (!state.reviewsView && config.layout.mode === "video") {
      const panel = productPanelState(root, config);
      list.innerHTML = reviews.flatMap((review) => review.media.filter((item) => item.kind === "video").map((raw) => {
        const item = decorateItemForPanel(absolutizeUserMedia(raw, root.__reviewsProxyBase), review, panel);
        return `<button type="button" class="rw-video-card" ${mediaTriggerAttributes(item, `Видео отзыва, ${review.authorName}`, Boolean(panel))} aria-label="${escapeAttribute(`Видео отзыва, ${review.authorName}`)}">
          ${item.previewUrl ? `<img src="${escapeAttribute(item.previewUrl)}" alt="" loading="lazy">` : ""}<span class="rw-play-badge" aria-hidden="true"></span>
          ${config.layout.video.showSourceBadge && config.visibility.marketplaceBadges ? `<span class="rw-video-card-src">${renderMarketplaceLabel(review.marketplace, config, review.marketplaceLabel)}</span>` : ""}
          ${config.layout.video.showAuthor ? `<span class="rw-video-card-author">${escapeHTML(review.authorName)}</span>` : ""}
          ${config.layout.tileHover ? `<span class="rw-tile-hover"><span class="rw-stars" style="--rating:${review.rating}"></span>${config.layout.video.showAuthor ? `<span>${escapeHTML(review.authorName)}</span>` : ""}<span class="rw-tile-label">Смотреть</span></span>` : ""}
        </button>`;
      })).join("");
      return;
    }
    const existing = new Map(Array.from(list.children).map((card) => [card.__review, card]));
    let previous = null;
    reviews.forEach((review) => {
      const key = reviewKey(review);
      const expanded = state.expandedTexts.has(key);
      let card = existing.get(review);
      existing.delete(review);
      if (card && card.__review === review && card.__expanded === expanded) {
        if (card !== (previous ? previous.nextElementSibling : list.firstElementChild)) list.insertBefore(card, previous ? previous.nextElementSibling : list.firstElementChild);
        previous = card;
        return;
      }
      const oldCard = card;
      card = document.createElement("article");
      card.className = "rw-card";
      card.dataset.reviewKey = key;
      card.__review = review;
      card.__expanded = expanded;
      const marketplaceLink = safeSourceURL(review.marketplaceReviewUrl) || safeSourceURL(review.marketplaceProductUrl);

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
    if (!state.config.visibility.marketplaceBadges) return "";
    const label = renderMarketplaceLabel(review.marketplace, config, review.marketplaceLabel);
    return label ? `<span class="rw-badge">${label}</span>` : "";
  }
      card.innerHTML = `
        ${renderMediaSet(review, config, root.__reviewsProxyBase, productPanelState(root, config))}
        <div class="rw-cbody">
          <div class="rw-chiprow"><span class="rw-av">${escapeHTML(initials(review.authorName || "Покупатель"))}</span><span><span class="rw-name">${escapeHTML(review.authorName || "Покупатель")}</span> <span class="rw-when">· ${relativeDate(review.createdAt)}</span></span></div>
          <div class="rw-stars rw-card-stars" style="margin-top:6px">${starRowHTML(review.rating)}</div>
          ${review.title ? `<div class="rw-card-title">${escapeHTML(review.title)}</div>` : ""}
          ${renderCardText(review, state, root.__reviewsWidgetConfig)}
          ${renderCustomTags(review, root.__reviewsWidgetConfig)}
          ${renderProsCons(review, root.__reviewsWidgetConfig)}
          ${renderAnswer(review.answer, root.__reviewsWidgetConfig)}
          <div class="rw-badges">${marketBadge(review)}${review.pinned ? `<span class="rw-badge n">${escapeHTML(config.labels.recentlyAdded)}</span>` : ""}${review.verifiedPurchase === true ? `<span class="rw-badge n">Проверенная покупка</span>` : ""}</div>
          ${marketplaceLink ? `<a class="rw-source-link" href="${escapeAttribute(marketplaceLink)}" target="_blank" rel="noopener noreferrer">Открыть источник отзыва</a>` : ""}
        </div>
      `;
      if (oldCard) oldCard.replaceWith(card);
      if (card !== (previous ? previous.nextElementSibling : list.firstElementChild)) list.insertBefore(card, previous ? previous.nextElementSibling : list.firstElementChild);
      previous = card;
    });
    existing.forEach((card) => card.remove());
  }
  function safeSourceURL(value) {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch { return ""; }
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
    item = { ...item, review, authorName: review.authorName || "Покупатель", marketplace: review.marketplace, marketplaceLabel: review.marketplaceLabel, rating: review.rating };
    if (!panel) return item;
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
      reviewAttrs: panel.config.customFields.filter((field) => field.showInReview && reviewCustomValue(review, field.id)).map((field) => `${panel.config.customTags.chipLabel ? field.label + " " : ""}${reviewCustomValue(review, field.id)}`),
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
    if (!config.layout.video.productPanel || config.viewer.chrome === "min" || root.classList.contains("rw-context-homepage")) {
      return null;
    }
    return {
      proxyBase: root.__reviewsProxyBase || "",
      config,
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
      `data-media-duration="${escapeAttribute(item.duration || "")}"`,
      `data-media-author="${escapeAttribute((item.review || item).authorName || "")}"`,
      `data-media-when="${escapeAttribute((item.review || item).createdAt instanceof Date ? (Number.isFinite((item.review || item).createdAt.getTime()) ? (item.review || item).createdAt.toISOString() : "") : (item.review || item).createdAt || "")}"`,
      `data-media-stars="${escapeAttribute(String((item.review || item).rating || 0))}"`,
      productPanel ? [
        `data-media-product-url="${escapeAttribute(item.productUrl || "")}"`,
        `data-media-product-image="${escapeAttribute(item.productImage || "")}"`,
        `data-media-product-rating="${escapeAttribute(item.productRating != null ? String(item.productRating) : "")}"`,
        `data-media-product-price="${escapeAttribute(item.productPrice || "")}"`,
        `data-media-product-name="${escapeAttribute(item.productName || "")}"`,
        `data-media-review-attrs="${escapeAttribute(JSON.stringify(item.reviewAttrs || []))}"`,
        `data-media-review-text="${escapeAttribute(item.reviewText || "")}"`,
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
    const rendered = collectRenderedMedia(root);
    const seen = new Set(rendered.map((item) => item.key));
    const items = rendered.concat(mediaItems(root, state).map((item) => ({ ...item, key: `${item.kind || "media"}:${item.url}` })).filter((item) => !seen.has(item.key)));
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
    viewer.__previousFocus = trigger;
    viewer.__previousScroll = root.querySelector(".rw-reviews-body").scrollTop;
    if (state.reviewsView) cancelMoreReviews(state);
    if (state) { state.viewerPlaying = state.config.layout.video.autoplayInViewer; state.viewerHovered = false; clearFeedTimer(state); }
    if (!viewer.open) viewer.showModal();
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
    viewer.querySelector('[data-role="viewer-stage"]').replaceChildren();
    if (state) state.viewerPlaying = false;
    const previousFocus = viewer.__previousFocus;
    if (!state.destroyed && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    if (state.reviewsView) root.querySelector(".rw-reviews-body").scrollTop = viewer.__previousScroll;
    scheduleFeedTimer(root, state);
    if (state.reviewsView && !state.destroyed) queueMicrotask(() => loadAllReviews(root, state));
  }

  function shiftMediaViewer(root, direction, state) {
    const viewer = root.querySelector('[data-role="media-viewer"]');
    if (!viewer || !viewer.open || !viewer.__items || viewer.__items.length === 0) {
      return;
    }
    viewer.__index = (viewer.__index + direction + viewer.__items.length) % viewer.__items.length;
    if (state) state.viewerPlaying = state.config.layout.video.autoplayInViewer;
    renderMediaViewer(root, state);
    scheduleViewerTimer(root, state);
  }

  function toggleViewerPlay(root, state) {
    const viewer = root.querySelector('[data-role="media-viewer"]');
    const video = viewer && viewer.querySelector("video");
    if (!viewer || !viewer.open || !video) return;
    if (video.paused) video.play().catch(() => { state.viewerPlaying = false; updateViewerPlay(root, state); });
    else video.pause();
  }
  function updateViewerPlay(root, state) {
    const button = root.querySelector('[data-role="viewer-play"]');
    if (button) {
      button.setAttribute("aria-label", state.viewerPlaying ? "Пауза" : "Воспроизвести");
      button.classList.toggle("is-paused", !state.viewerPlaying);
    }
    scheduleViewerTimer(root, state);
  }

  function clearViewerTimer(root, state) {
    if (state && state.viewerTimer) { clearTimeout(state.viewerTimer); state.viewerTimer = null; }
    const prog = root.querySelector('[data-role="viewer-progress"]');
    if (prog) prog.hidden = true;
  }

  function scheduleViewerTimer(root, state) {
    if (!state) return;
    if (!root.isConnected) { root.__reviewsWidget?.destroy(); return; }
    clearViewerTimer(root, state);
    const viewer = root.querySelector('[data-role="media-viewer"]');
    if (!viewer || !viewer.open) return;
    const cfg = state.config.layout.player.autoAdvance;
    if (!cfg.enabled || !state.viewerPlaying || state.viewerHovered || state.destroyed) return;
    const items = viewer.__items || [];
    const item = items[viewer.__index];
    if (!item || item.kind !== "video" || items.length < 2) return;
    const video = viewer.querySelector("video");
    if (!video || video.paused || video.readyState < 2) return;
    const dur = Math.max(0.1, Number.isFinite(video.duration) ? video.duration - video.currentTime : durationSeconds(item.duration) || cfg.intervalSec);
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
  function durationSeconds(value) {
    const text = String(value || "");
    const match = /^(\d+):([0-5]\d)$/.exec(text);
    const seconds = match ? Number(match[1]) * 60 + Number(match[2]) : Number(value);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
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
    const canPlayVideo = item.kind === "video" && !item.embedProvider && !isLikelyImageURL(item.url);
    const canShowImage = item.kind !== "video" || item.previewUrl || isLikelyImageURL(item.url);
    const rawViewerSrc = item.kind === "video" ? item.previewUrl || item.url : item.url || item.previewUrl;
    const viewerSrc = item.kind === "video" ? rawViewerSrc : mediaProxyURL(rawViewerSrc, root.__reviewsProxyBase);
    const captionText = item.caption || (item.kind === "video" ? "Видео отзыва" : "Фото отзыва");
    const review = item.review || {};
    if (avatar) avatar.textContent = initials(review.authorName || "Покупатель");
    if (nameEl) nameEl.textContent = review.authorName || "Покупатель";
    if (whenEl) whenEl.textContent = review.createdAt ? ` · ${formatDate(review.createdAt)}` : "";
    if (starsEl) starsEl.style.setProperty("--rating", String(review.rating || 0));
    if (original) {
      const originalURL = safeSourceURL(item.url);
      original.hidden = !originalURL;
      if (originalURL) original.href = originalURL;
      else original.removeAttribute("href");
      original.textContent = item.kind === "video" ? "Открыть видео" : "Открыть оригинал";
    }
    if (counter) counter.textContent = `${viewer.__index + 1} / ${items.length}`;
    if (prev) prev.hidden = items.length < 2;
    if (next) next.hidden = items.length < 2;
    const autoPlay = Boolean(state && state.viewerPlaying);
    if (playBtn) {
      playBtn.hidden = !canPlayVideo;
      playBtn.setAttribute("aria-label", state && state.viewerPlaying ? "Пауза" : "Воспроизвести");
      playBtn.classList.toggle("is-paused", !(state && state.viewerPlaying));
    }
    if (progress) progress.hidden = !(canPlayVideo && cfg.layout && cfg.layout.player.autoAdvance.enabled && state && state.viewerPlaying);
    const viewerVideoAttrs = autoPlay ? " autoplay muted" : "";
    const panel = productPanelState(root, cfg) ? renderProductPanel(item) : "";
    const embedSrc = embedFrameURL(item);
    const mediaHTML = embedSrc
      ? `<iframe class="rw-media-viewer-embed" src="${escapeAttribute(embedSrc)}" title="${escapeAttribute(captionText)}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`
      : canPlayVideo
        ? `<video class="rw-media-viewer-video" src="${escapeAttribute(item.url)}"${item.previewUrl ? ` poster="${escapeAttribute(item.previewUrl)}"` : ""} controls playsinline${viewerVideoAttrs}></video>`
        : canShowImage ? `<img class="rw-media-viewer-image" src="${escapeAttribute(viewerSrc)}" alt="${escapeAttribute(captionText)}" />`
          : safeSourceURL(item.url) ? `<a class="rw-media-viewer-placeholder" href="${escapeAttribute(safeSourceURL(item.url))}" target="_blank" rel="noreferrer">Открыть медиа</a>` : `<span class="rw-media-viewer-placeholder">Медиа недоступно</span>`;
    stage.innerHTML = panel ? `<div class="rw-media-viewer-with-panel"><div class="rw-product-panel-stage">${mediaHTML}</div>${panel}</div>` : mediaHTML;
    const video = stage.querySelector("video");
    if (video) {
      const current = () => viewer.open && video === stage.querySelector("video") && !state.destroyed;
      video.addEventListener("play", () => { if (current()) { state.viewerPlaying = true; updateViewerPlay(root, state); } });
      video.addEventListener("playing", () => { if (current()) { state.viewerPlaying = true; updateViewerPlay(root, state); } });
      video.addEventListener("pause", () => { if (current()) { state.viewerPlaying = false; updateViewerPlay(root, state); } });
      video.addEventListener("waiting", () => { if (current()) clearViewerTimer(root, state); });
      video.addEventListener("seeking", () => { if (current()) clearViewerTimer(root, state); });
      video.addEventListener("seeked", () => { if (current()) scheduleViewerTimer(root, state); });
      video.addEventListener("ended", () => {
        if (current() && cfg.layout.player.autoAdvance.enabled && !state.viewerHovered && items.length > 1) shiftMediaViewer(root, 1, state);
      });
      video.addEventListener("error", () => { if (current()) { state.viewerPlaying = false; updateViewerPlay(root, state); } });
      if (autoPlay) video.play().catch(() => { if (current()) { state.viewerPlaying = false; updateViewerPlay(root, state); } });
    }
    if (queue) {
      queue.innerHTML = items.map((q, qi) => `
        <button type="button" class="rw-media-q" data-queue-index="${qi}" aria-current="${qi === viewer.__index}" aria-label="${escapeAttribute(q.kind === "video" ? "Видео" : "Фото")} · ${escapeAttribute((q.review || {}).authorName || "Покупатель")}">
          ${q.kind !== "video" || q.previewUrl ? `<img src="${escapeAttribute(q.kind === "video" ? q.previewUrl : mediaProxyURL(q.url, root.__reviewsProxyBase))}" alt="" loading="lazy" />` : ""}
          ${q.kind === "video" ? '<span class="rw-media-q-play" aria-hidden="true"></span>' : ""}
        </button>`).join("");
    }
  }

  function renderProductPanel(item) {
    const productURL = item && safeSourceURL(item.productUrl);
    if (!productURL) {
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
        <a class="rw-product-panel-link" href="${escapeAttribute(productURL)}" target="_blank" rel="noreferrer">Посмотреть товар</a>
        ${quote}
        ${attrs}
      </aside>
    `;
    return html;
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
        duration: node.getAttribute("data-media-duration") || "",
        embedProvider: node.getAttribute("data-media-embed-provider") || "",
        embedId: node.getAttribute("data-media-embed-id") || "",
        productUrl: node.getAttribute("data-media-product-url") || "",
        productImage: node.getAttribute("data-media-product-image") || "",
        productRating: node.getAttribute("data-media-product-rating") || "",
        productPrice: node.getAttribute("data-media-product-price") || "",
        productName: node.getAttribute("data-media-product-name") || "",
        reviewAttrs: JSON.parse(node.getAttribute("data-media-review-attrs") || "[]"),
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
    return `<div class="rw-answer" data-answer-kind="${escapeAttribute(answer.kind || "")}" data-ans-style="${escapeAttribute(answers.style)}">${showTitle ? `<b>${escapeHTML(title)}:</b> ` : ""}${escapeHTML(answer.text)}</div>`;
  }

  // ── Custom form fields (товарные атрибуты: рост/вес/посадка) ──────────

  // Clamp an admin-configured customFields list the same way normalizeConfig
  // clamps its knobs: hard limits, type whitelist, option cleanup.
  function normalizeCustomFields(raw) {
    const fields = Array.isArray(raw) ? raw.slice(0, 6) : [];
    const out = [];
    const seen = Object.create(null);
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
    const required = field.required ? " required" : "";
    if (field.type === "select") {
      return `<label class="rw-custom-field">${head}<select class="rw-input-w" name="custom-${escapeAttribute(field.id)}"${required}><option value="">Не указан</option>${field.options.map((o) => `<option value="${escapeAttribute(o)}">${escapeHTML(o)}</option>`).join("")}</select></label>`;
    }
    if (field.type === "text") {
      return `<label class="rw-custom-field">${head}<input class="rw-input-w" name="custom-${escapeAttribute(field.id)}" maxlength="60" placeholder="Ваш ответ"${required}></label>`;
    }
    return `<fieldset class="rw-custom-field rw-custom-chips" data-custom-chips="${escapeAttribute(field.id)}"><legend>${escapeHTML(field.label)}${req}</legend><div class="rw-chip-row">${field.options.map((o) => `<button type="button" class="rw-fchip rw-chip" data-custom-field="${escapeAttribute(field.id)}" data-custom-value="${escapeAttribute(o)}" aria-pressed="false">${escapeHTML(o)}</button>`).join("")}</div><input type="hidden" name="custom-${escapeAttribute(field.id)}" value="" /></fieldset>`;
  }

  function renderCustomFields(fields) {
    if (!fields.length) return "";
    return fields.map(renderCustomField).join("");
  }

  function submissionConfig(state) {
    return state.preview ? { ...(state.submission.config || {}), enabled: true, customFields: state.config.customFields } : state.submission.config || {};
  }
  function canSubmit(state) {
    return state.config.layout.sections.includes("form") && state.context === "product" && (state.preview || (!state.submission.loading && state.submission.config && state.submission.config.enabled !== false && Boolean(state.submissionUrl)));
  }
  function clearFormMedia(state) {
    (state.formMedia || []).forEach((entry) => { if (entry.preview && entry.preview.startsWith("blob:")) URL.revokeObjectURL(entry.preview); });
    state.formMedia = [];
  }
  function saveFormDraft(root, state) {
    if (state.formDone) return;
    const form = root.querySelector(state.formModalOpen ? '[data-role="form-modal"] [data-role="submit-form"]' : '[data-role="submit"] [data-role="submit-form"]');
    if (!form) return;
    for (const input of form.elements) {
      if (!input.name || input.type === "file" || ["sellerArticle", "openedAt"].includes(input.name)) continue;
      state.formDraft[input.name] = input.type === "checkbox" ? input.checked : input.value;
    }
  }
  function restoreFormDraft(form, state) {
    if (!form) return;
    for (const input of form.elements) {
      if (!input.name || input.type === "file" || !Object.hasOwn(state.formDraft, input.name)) continue;
      if (input.type === "checkbox") input.checked = Boolean(state.formDraft[input.name]);
      else input.value = state.formDraft[input.name];
    }
    form.querySelectorAll("[data-custom-chips]").forEach((group) => {
      const value = group.querySelector('input[type="hidden"]').value;
      group.querySelectorAll("[data-custom-value]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.customValue === value)));
    });
    updateFormControls(form, state);
  }
  function formBodyHTML(root, state) {
    const cfg = submissionConfig(state);
    const formCfg = state.config.form;
    const fields = formCfg.fields;
    const consentLabel = escapeHTML(cfg.consentLabel || "Согласен(на) на публикацию отзыва и обработку персональных данных");
    const consent = cfg.privacyUrl ? `<a href="${escapeAttribute(cfg.privacyUrl)}" target="_blank" rel="noreferrer">${consentLabel}</a>` : consentLabel;
    const rating = Number(state.formRating || 0);
    const stars = [1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" class="rw-form-star${n <= rating ? " is-on" : ""}" data-role="form-star" data-star="${n}" aria-label="${n} из 5" aria-checked="${n === rating}" tabindex="${n === (rating || 1) ? 0 : -1}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.36L12 17.4l-5.7 3-1.09-6.37-4.62-4.49 6.38-.93L12 2.8z"/></svg></button>`).join("");
    return `<form class="rw-submit-form" data-role="submit-form">
      <input type="text" name="website" class="rw-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <input type="hidden" name="openedAt" value="${state.submission.openedAt}">
      <input type="hidden" name="sellerArticle" value="${escapeAttribute(state.sellerArticle)}">
      <div><b>${escapeHTML(formCfg.title)}</b><p class="rw-hintform">Оценка и текст — обязательные поля.${state.preview ? " Предпросмотр: отзыв не будет отправлен." : " Отзыв появится после модерации."}</p></div>
      <div><span class="rw-flabel">Оценка</span><div class="rw-form-stars" role="radiogroup" aria-label="Оценка">${stars}</div></div>
      <label><span class="rw-flabel">Имя</span><input class="rw-input-w" name="authorName" required maxlength="80" autocomplete="name" placeholder="Как вас зовут"></label>
      ${fields.title ? `<label><span class="rw-flabel">Заголовок</span><input class="rw-input-w" name="title" maxlength="512" placeholder="Коротко о главном" data-role="form-title"></label>` : ""}
      <label><span class="rw-flabel">Email — не публикуется</span><input class="rw-input-w" name="authorEmail" type="email" required maxlength="320" autocomplete="email" placeholder="name@mail.ru"></label>
      ${renderCustomFields(normalizeCustomFields(cfg.customFields || []))}
      <label><span class="rw-flabel">Отзыв</span><textarea class="rw-input-w" name="text" required maxlength="3000" placeholder="Расскажите о покупке…"></textarea></label>
      ${fields.prosCons ? `<div class="rw-frow2"><label><span class="rw-flabel">Плюсы</span><textarea class="rw-input-w" name="pros" maxlength="3000"></textarea></label><label><span class="rw-flabel">Минусы</span><textarea class="rw-input-w" name="cons" maxlength="3000"></textarea></label></div>` : ""}
      ${fields.media ? `<span class="rw-hintform">До ${Math.min(formCfg.maxMedia, Number(cfg.maxFiles) || formCfg.maxMedia)} файлов</span>` : ""}
      ${fields.media ? `<div><span class="rw-flabel">${escapeHTML(formCfg.mediaHint || "Фото или видео")}</span><div class="rw-form-upload"><input name="media" type="file" accept="${escapeAttribute((cfg.allowedTypes || []).join(",") || "image/*,video/*")}" multiple data-role="form-media" hidden><button type="button" class="rw-form-add" data-role="form-add-media"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v12H4Z"/><circle cx="12" cy="13.5" r="3.4"/></svg>Добавить</button><span class="rw-form-thumbs"></span></div></div>` : ""}
      <label class="rw-consent"><input name="privacyConsent" type="checkbox" required> <span>${consent}</span></label>
      <span class="rw-ferr" data-role="form-error" role="alert" hidden></span>
      <button class="rw-submit-send" type="submit"${state.submission.sending ? " disabled" : ""}>${state.submission.sending ? "Отправляем" : escapeHTML(formCfg.submitLabel)}</button>
    </form>`;
  }

  function successHTML(state) {
    return `
      <div class="rw-form-done">
        <span class="rw-form-done-ok" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <b>${state.preview ? "Предпросмотр заполнен" : "Спасибо! Отзыв отправлен"}</b>
        <p>${state.preview ? "Это демонстрация формы. Отзыв не отправлен и не опубликован." : "Он появится в списке после модерации."}</p>
        <span class="rw-form-done-actions">
          <button type="button" class="rw-submit-send" data-role="form-done">Готово</button>
          <button type="button" class="rw-form-again" data-role="form-again">Заполнить ещё раз</button>
        </span>
      </div>
    `;
  }

  function openFormModal(root, state) {
    const modal = root.querySelector('[data-role="form-modal"]');
    if (!canSubmit(state) || !modal || typeof modal.showModal !== "function") return;
    saveFormDraft(root, state);
    state.formModalOpen = true;
    renderFormModal(root, state);
    if (modal.open) return;
    modal.__previousFocus = root.getRootNode().activeElement;
    modal.showModal();
    const close = modal.querySelector('[data-role="form-modal-close"]');
    if (close) close.focus();
  }

  function closeFormModal(root, state) {
    const modal = root.querySelector('[data-role="form-modal"]');
    if (!modal || !modal.open) return;
    saveFormDraft(root, state);
    modal.close();
    state.formModalOpen = false;
    state.formDone = false;
    const previousFocus = modal.__previousFocus;
    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
    modal.__previousFocus = null;
    renderSubmission(root, state, true);
  }
  function updateFormControls(form, state) {
    if (!form) return;
    form.querySelectorAll('[data-role="form-star"]').forEach((button) => {
      const on = Number(button.getAttribute("data-star")) <= Number(state.formRating || 0);
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-checked", String(Number(button.dataset.star) === Number(state.formRating)));
      button.tabIndex = Number(button.dataset.star) === (Number(state.formRating) || 1) ? 0 : -1;
    });
    const thumbs = form.querySelector(".rw-form-thumbs");
    if (thumbs) {
      thumbs.innerHTML = (state.formMedia || []).map((entry, idx) => `<span class="rw-form-thumb">${entry.file.type.startsWith("video/") ? `<video src="${escapeAttribute(entry.preview)}" muted preload="metadata"></video>` : `<img src="${escapeAttribute(entry.preview)}" alt="" />`}<button type="button" data-role="form-thumb-remove" data-thumb-index="${idx}" aria-label="Убрать файл">×</button></span>`).join("");
    }
    const error = form.querySelector('[data-role="form-error"]');
    if (error) { error.textContent = state.formError || ""; error.hidden = !state.formError; }
    const submit = form.querySelector('[type="submit"]');
    if (submit) {
      submit.disabled = state.submission.sending;
      submit.textContent = state.submission.sending ? "Отправляем…" : state.config.form.submitLabel || defaultConfig.form.submitLabel;
    }
  }


  function renderFormModal(root, state) {
    const modal = root.querySelector('[data-role="form-modal"]');
    if (!modal) return;
    const titleEl = modal.querySelector('[data-role="form-modal-title"]');
    if (titleEl) titleEl.textContent = state.config.form.title || defaultConfig.form.title;
    const body = modal.querySelector('[data-role="form-modal-body"]');
    if (!body) return;
    body.innerHTML = state.formDone ? successHTML(state) : formBodyHTML(root, state);
    restoreFormDraft(body.querySelector("form"), state);
  }

  function renderSubmission(root, state, draftSaved) {
    const submitRoot = root.querySelector('[data-role="submit"]');
    if (!submitRoot) return;
    const formCfg = state.config.form;
    if (!draftSaved) saveFormDraft(root, state);
    if (!canSubmit(state) || formCfg.ctaMode === "header") {
      submitRoot.hidden = true;
      submitRoot.innerHTML = "";
      return;
    }
    submitRoot.hidden = false;
    submitRoot.classList.toggle("rw-submit-cta", formCfg.mode === "button");
    if (state.formDone && !state.formModalOpen) submitRoot.innerHTML = successHTML(state);
    else if (formCfg.mode === "button") submitRoot.innerHTML = `<div class="rw-form-cta"><div class="rw-form-cta-text"><b>${escapeHTML(formCfg.cta.text)}</b>${formCfg.cta.hint ? `<p>${escapeHTML(formCfg.cta.hint)}</p>` : ""}</div><button class="rw-form-cta-btn" type="button" data-role="form-cta-open">${escapeHTML(formCfg.cta.text)}</button></div>`;
    else {
      const existingForm = submitRoot.querySelector('[data-role="submit-form"]');
      if (existingForm) {
        if (draftSaved) restoreFormDraft(existingForm, state);
        else updateFormControls(existingForm, state);
        return;
      }
      submitRoot.innerHTML = formBodyHTML(root, state);
      restoreFormDraft(submitRoot.querySelector("form"), state);
    }
  }

  async function submitReview(root, state, form) {
    if (!canSubmit(state) || !form.reportValidity()) return;
    const cfg = submissionConfig(state);
    const required = normalizeCustomFields(cfg.customFields || []).find((field) => field.required && !String(new FormData(form).get(`custom-${field.id}`) || "").trim());
    if (required) { state.formError = `Заполните поле «${required.label}»`; updateFormControls(form, state); return; }
    if (state.submission.sending) return;
    if (state.config.form.fields.media && (state.formMedia || []).length > Math.min(state.config.form.maxMedia, Number(cfg.maxFiles) || state.config.form.maxMedia)) {
      state.formError = "Уберите лишние вложения перед отправкой";
      updateFormControls(form, state);
      return;
    }
    if (!(Number(state.formRating || 0) >= 1)) {
      state.formError = "Выберите оценку — без неё отзыв не публикуется";
      updateFormControls(form, state);
      return;
    }
    state.formRating = Number(state.formRating);
    state.submission.sending = true;
    state.formError = "";
    state.submission.error = "";
    state.submission.message = "";
    const formData = new FormData(form);
    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Отправляем…";
    }
    try {
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
      formData.delete("media");
      if (state.config.form.fields.media) (state.formMedia || []).forEach((entry) => formData.append("media", entry.file, entry.file.name));
      const custom = Object.create(null);
      formData.forEach((value, key) => {
        if (key.indexOf("custom-") === 0 && typeof value === "string" && value) {
          custom[key.slice(7)] = value;
        }
      });
      if (Object.keys(custom).length) {
        formData.set("custom", JSON.stringify(custom));
      }
      if (state.preview) {
        state.submission.sending = false;
        state.formDone = true;
        state.formDraft = {};
        clearFormMedia(state);
        if (state.formModalOpen) renderFormModal(root, state); else render(root, state);
        return;
      }
      const response = await fetch(state.submissionUrl, { method: "POST", body: formData });
      if (state.destroyed) return;
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Не удалось отправить отзыв" }));
        throw new Error(payload.error || "Не удалось отправить отзыв");
      }
      state.submission.sending = false;
      state.submission.expanded = false;
      state.submission.message = "";
      state.formDone = true;
      clearFormMedia(state);
      state.formDraft = {};
      state.formRating = 0;
      state.submission.openedAt = Date.now();
      if (state.formModalOpen) renderFormModal(root, state);
      else render(root, state);
    } catch (error) {
      if (state.destroyed) return;
      state.submission.sending = false;
      state.formError = error.message || "Не удалось отправить отзыв";
      state.submission.error = "";
      root.querySelectorAll('[data-role="submit-form"]').forEach((currentForm) => updateFormControls(currentForm, state));
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
    if ((!apiBase && !state.preview) || state.context !== "product") {
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
          <p>${state.preview ? "Предпросмотр: вопрос не будет отправлен." : "Вопрос появится после ответа продавца."}</p>
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
    if (state.preview || !apiBase || !state.sellerArticle) {
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
      if (state.destroyed) return;
      // Server returns {"questions": [{question, answer, date}, ...]}
      state.questions.items = Array.isArray(payload) ? payload : (payload.questions || []);
      state.questions.loading = false;
      state.questions.loaded = true;

      // Update question count badge
      const qCountEl = root.querySelector('[data-role="question-count"]');
      if (qCountEl) qCountEl.textContent = String(state.questions.items.length);

      render(root, state);
    } catch (error) {
      if (state.destroyed) return;
      state.questions.loading = false;
      state.questions.loaded = true;
      state.questions.error = error.message || "Не удалось загрузить вопросы";
      render(root, state);
    }
  }

  async function submitQuestion(root, state, form) {
    if (state.questionForm.sending || !form.reportValidity()) return;
    const formData = new FormData(form);
    state.questionForm.sending = true;
    state.questionForm.error = "";
    state.questionForm.message = "";
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = "Отправляем";
    try {
      formData.set("sellerArticle", state.sellerArticle || formData.get("sellerArticle") || "");
      formData.set("openedAt", String(state.questionForm.openedAt));
      if (!state.preview) {
        const apiBase = state._questionsApiBase || "";
        const url = `${apiBase}/api/questions${state._publicKey ? `?public_key=${encodeURIComponent(state._publicKey)}` : ""}`;
        const response = await fetch(url, { method: "POST", body: formData });
        if (state.destroyed) return;
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "Не удалось отправить вопрос" }));
          throw new Error(payload.error || "Не удалось отправить вопрос");
        }
      }
      state.questionForm.sending = false;
      state.questionForm.expanded = false;
      state.questionForm.message = state.preview ? "Предпросмотр заполнен. Вопрос не отправлен." : "Вопрос отправлен";
      state.questionForm.openedAt = Date.now();
      render(root, state);
    } catch (error) {
      if (state.destroyed) return;
      state.questionForm.sending = false;
      state.questionForm.error = error.message || "Не удалось отправить вопрос";
      button.disabled = false;
      button.textContent = "Отправить вопрос";
      let message = form.querySelector(".rw-submit-error");
      if (!message) { message = document.createElement("span"); message.className = "rw-submit-error"; message.setAttribute("role", "alert"); button.after(message); }
      message.textContent = state.questionForm.error;
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
    return (Array.isArray(reviews) ? reviews : [])
      .map((review) => applyMarketplacePolicy({
        ...review,
        rating: Number.isInteger(Number(review.rating)) && Number(review.rating) >= 1 && Number(review.rating) <= 5 ? Number(review.rating) : 0,
        title: String(review.title || "").trim(),
        product: review.product && typeof review.product === "object"
          ? { name: String(review.product.name || ""), price: String(review.product.price || "") }
          : null,
        createdAt: new Date(review.createdAt),
        media: (Array.isArray(review.media) ? review.media : []).filter((item) => item && item.url).map((item) => ({
          ...item,
          kind: item.kind === "video" ? "video" : "photo",
          duration: formatMediaDuration(item.duration),
          likes: Number.isFinite(Number(item.likes)) && Number(item.likes) > 0 ? Math.round(Number(item.likes)) : 0,
        })),
        pinned: Boolean(review.pinned),
      }, config))
      .filter(Boolean);
  }

  // BE: media[].duration — float seconds (0 = скрыть). Рендер «0:24».
  function formatMediaDuration(seconds) {
    const n = durationSeconds(seconds);
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

  function normalizeAggregate(aggregate) {
    if (!aggregate || typeof aggregate !== "object") {
      return null;
    }
    const totalReviews = Number(aggregate.totalReviews ?? aggregate.count);
    const ratingCount = Number(aggregate.ratingCount ?? totalReviews);
    const averageRating = Number(aggregate.averageRating ?? aggregate.ratingAvg);
    const recommendPercent = aggregate.recommendPercent == null ? NaN : Number(aggregate.recommendPercent);
    return {
      totalReviews: Number.isFinite(totalReviews) && totalReviews >= 0 ? totalReviews : null,
      ratingCount: Number.isFinite(ratingCount) && ratingCount >= 0 ? ratingCount : null,
      averageRating: Number.isFinite(averageRating) && averageRating > 0 && averageRating <= 5 ? averageRating : null,
      ...(Number.isFinite(recommendPercent) && recommendPercent >= 0 && recommendPercent <= 100 ? { recommendPercent } : {}),
      distribution: Array.isArray(aggregate.distribution) ? aggregate.distribution.filter((row) => row && typeof row === "object").map((row) => ({ stars: Number(row.stars ?? row.rating), percent: Number(row.percent) })).filter((row) => Number.isInteger(row.stars) && row.stars >= 1 && row.stars <= 5 && Number.isFinite(row.percent) && row.percent >= 0 && row.percent <= 100) : [],
    };
  }

  const widgetSections = { summary: true, player: true, media: true, filters: true, list: true, form: true };

  function normalizeSections(raw, visibility) {
    const explicit = Array.isArray(raw);
    const hidden = explicit ? {} : {
      summary: visibility.ratingDistribution === false,
      player: visibility.videoRail === false,
      media: visibility.photos === false,
      filters: visibility.filters === false,
    };
    const out = unique((explicit ? raw : defaultConfig.layout.sections).filter((id) => Object.hasOwn(widgetSections, id) && !hidden[id]));
    if (!out.includes("list")) out.push("list");
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
    const distribution = merged.header.distribution || {};
    merged.header.distribution = {
      position: ["auto", "beside", "below"].includes(distribution.position) ? distribution.position : defaultConfig.header.distribution.position,
      width: ["compact", "full"].includes(distribution.width) ? distribution.width : defaultConfig.header.distribution.width,
      density: ["compact", "normal"].includes(distribution.density) ? distribution.density : defaultConfig.header.distribution.density,
    };
    merged.header.elements = { ...defaultConfig.header.elements, ...(merged.header.elements || {}) };
    if (!(config.header && config.header.elements && Object.hasOwn(config.header.elements, "distribution"))) {
      merged.header.elements.distribution = merged.visibility.ratingDistribution !== false;
    }
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
    merged.filters.hideRare = merged.filters.hideRare === true;
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
    merged.appearance.marketplaceDisplay = merged.appearance.marketplaceDisplay === "icons" ? "icons" : "text";
    merged.typography.scale = clampNumber(merged.typography.scale, 0.85, 1.25, 1);
    merged.typography.radius = Math.round(clampNumber(merged.typography.radius, 0, 24, 16));
    merged.layout.columns = Math.round(clampNumber(merged.layout.columns, 1, 4, 2));
    merged.layout.pageSize = Math.round(clampNumber(merged.layout.pageSize, 1, 24, 3));
    merged.layout.pagination = merged.layout.pagination === "pages" ? "pages" : "more";
    merged.layout.loadMoreAction = merged.layout.loadMoreAction === "dialog" ? "dialog" : "inline";
    const mediacard = { ...defaultConfig.layout.mediacard, ...(merged.layout.mediacard || {}) };
    mediacard.layout = ["row", "grid", "collage", "one"].includes(mediacard.layout) ? mediacard.layout : "row";
    mediacard.aspect = ["16:10", "1:1", "4:5"].includes(mediacard.aspect) ? mediacard.aspect : "16:10";
    mediacard.maxTiles = [3, 4, 6].includes(mediacard.maxTiles) ? mediacard.maxTiles : 4;
    mediacard.plusMore = mediacard.plusMore !== false;
    mediacard.videoBadge = mediacard.videoBadge !== false;
    merged.layout.mediacard = mediacard;
    const video = { ...defaultConfig.layout.video, ...(merged.layout.video || {}) };
    video.aspect = ["3:4", "9:16", "1:1"].includes(video.aspect) ? video.aspect : "9:16";
    video.tileWidth = Math.round(clampNumber(video.tileWidth, 120, 200, 156));
    video.showAuthor = video.showAuthor !== false;
    video.showSourceBadge = video.showSourceBadge !== false;
    video.autoplayInViewer = video.autoplayInViewer !== false;
    video.productPanel = video.productPanel !== false;
    const player = { ...defaultConfig.layout.player, ...(merged.layout.player || {}) };
    player.enabled = player.enabled !== false;
    player.tile = { ...defaultConfig.layout.player.tile, ...(player.tile || {}) };
    player.tile.aspect = ["9:16", "3:4", "1:1"].includes(player.tile.aspect) ? player.tile.aspect : "9:16";
    player.tile.width = Math.round(clampNumber(player.tile.width, 120, 200, 156));
    player.showAuthor = player.showAuthor !== false;
    player.showLikes = player.showLikes !== false;
    player.showSourceBadge = player.showSourceBadge !== false;
    player.autoAdvance = { ...defaultConfig.layout.player.autoAdvance, ...(player.autoAdvance || {}) };
    player.autoAdvance.enabled = player.autoAdvance.enabled !== false;
    player.autoAdvance.intervalSec = clampNumber(player.autoAdvance.intervalSec, 4, 10, 5);
    player.autoAdvance.pauseOnHover = player.autoAdvance.pauseOnHover !== false;
    merged.layout.player = player;
    merged.layout.tileHover = merged.layout.tileHover !== false;
    merged.layout.sections = normalizeSections(config.layout && config.layout.sections, merged.visibility);
    if (!["list", "grid", "carousel", "video", "wall"].includes(merged.layout.mode)) {
      merged.layout.mode = "list";
    }
    merged.layout.video = video;
    const wall = { ...defaultConfig.layout.wall, ...(merged.layout.wall || {}) };
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
    ["title", "email", "media", "prosCons"].forEach((key) => {
      merged.form.fields[key] = merged.form.fields[key] !== false;
    });
    merged.form.fields.email = true;
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
    state.visible = state.reviewsView ? Math.max(12, state.config.layout.pageSize) : initialVisible(state.config);
    state.expanded = true;
    state.pagerPage = 0;
    state.carouselOrder = null;
    state.carouselPaused = false;
    state.resetScroll = true;
  }

  function effectiveVisibleCount(state, total) {
    return Math.min(total, state.visible);
  }

  function reviewPoolComplete(state) {
    if (state.loading || state.error) return false;
    if (state.fullFeedSource) return state.fullFeedExhausted;
    return !state.sourceIncomplete && !(state.aggregate && state.aggregate.totalReviews > state.rawReviews.length);
  }

  function summaryAggregate(reviews, state) {
    return { ...aggregateFromReviews(reviews), complete: reviewPoolComplete(state) };
  }

  function aggregateFromReviews(reviews) {
    const distribution = [0, 0, 0, 0, 0, 0];
    let ratingCount = 0, sum = 0, highRatings = 0;
    for (const review of reviews) {
      if (review.rating <= 0) continue;
      ratingCount++;
      sum += review.rating;
      if (review.rating >= 4) highRatings++;
      if (Number.isInteger(review.rating)) distribution[review.rating]++;
    }
    return {
      totalReviews: reviews.length,
      ratingCount,
      averageRating: ratingCount ? sum / ratingCount : null,
      recommendPercent: ratingCount ? highRatings / ratingCount * 100 : null,
      distribution,
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
    const darkDefaults = { accent: "#b99bdf", accentInk: "#211b29", text: "#f0eaf5", muted: "#b8adbf", panel: "#211d26", border: "#4d4356", star: "#e5ba62" };
    const palette = { ...config.theme };
    for (const key of Object.keys(darkDefaults)) {
      const value = normalizeHexColor(palette[key]) || defaultConfig.theme[key];
      palette[key] = config.theme.dark && value.toLowerCase() === defaultConfig.theme[key].toLowerCase() ? darkDefaults[key] : value;
    }
    const theme = config.typography.inheritSite ? {
      ...palette,
      accent: siteValue("--ys-color-token-brand-primary", palette.accent),
      accentInk: siteValue("--ys-color-token-brand-primary-contrast", palette.accentInk),
      text: siteValue("--ys-color-token-text-primary", palette.text),
      muted: siteValue("--ys-color-token-text-secondary", palette.muted),
      panel: siteValue("--ys-background-primary", palette.panel),
      border: siteValue("--ys-color-token-border-primary", palette.border),
    } : palette;
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
    root.style.setProperty("--rw-bg", config.theme.dark ? theme.panel : "transparent");
    root.style.setProperty("--rw-accent", theme.accent);
    root.style.setProperty("--rw-accent-ink", theme.accentInk);
    root.style.setProperty("--rw-accent-hover", mixChannels(accent, [0, 0, 0], 0.15));
    root.style.setProperty("--rw-soft", mixChannels(panel, text, 0.04));
    root.style.setProperty("--rw-soft-muted", mixChannels(panel, muted, 0.55));
    root.style.setProperty("--rw-accent-tint", mixChannels(panel, accent, 0.08));
    root.style.setProperty("--rw-accent-tint-2", mixChannels(panel, accent, 0.2));
    root.style.setProperty("--rw-accent-wash", mixChannels(panel, accent, 0.04));
    root.style.setProperty("--rw-text-faint", rgba(text, 0.08));
    root.style.setProperty("--rw-shadow", rgba(text, 0.1));
    root.style.setProperty("--rw-star-soft", mixChannels(panel, star, 0.18));
    root.style.setProperty("--rw-trust", config.theme.dark ? "#9ac5a4" : "#4E7C59");
    root.style.setProperty("--rw-trust-tint", mixChannels(panel, trust, 0.12));
    root.style.fontFamily = config.typography.inheritSite
      ? siteValue("--ys-font-family", siteStyle.fontFamily || "inherit")
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
    root.classList.toggle("rw-hide-distribution", !config.header.elements.distribution);
    root.classList.toggle("rw-hide-badges", !config.visibility.marketplaceBadges);
    root.classList.toggle("rw-hide-filters", !config.layout.sections.includes("filters"));
    root.classList.toggle("rw-dark", config.theme.dark === true);

    // Схема шапки: ряд / стопка / центр.
    root.classList.toggle("rw-head-stack", config.header.layout === "stack");
    root.classList.toggle("rw-head-center", config.header.layout === "center");

    // Ответ продавца: цвет и стиль.
    const answers = config.answers || defaultConfig.answers;
    const answerColor = config.theme.dark && answers.color.toLowerCase() === defaultConfig.answers.color.toLowerCase() ? "#9ac5a4" : answers.color;
    const ansChannels = colorChannels(answerColor, defaultConfig.answers.color);
    root.style.setProperty("--rw-ans", answerColor);
    root.style.setProperty("--rw-ans-tint", mixChannels(panel, ansChannels, 0.08));
    root.style.setProperty("--rw-ans-border", mixChannels(panel, ansChannels, 0.28));
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

  async function fetchReviews(source, signal) {
    const response = await fetch(source, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) {
      throw new Error(`API вернул ${response.status}`);
    }
    const payload = await response.json();
    const reviews = Array.isArray(payload) ? payload : Array.isArray(payload?.reviews) ? payload.reviews : [];
    const sourceURL = new URL(source, window.location.href);
    const params = sourceURL.searchParams;
    const requestedLimit = Number(params.get("limit"));
    const limit = sourceURL.pathname === "/api/reviews" && (!Number.isInteger(requestedLimit) || requestedLimit <= 0 || requestedLimit > 500) ? 100 : requestedLimit;
    const partial = Number(params.get("offset")) > 0 || (limit > 0 && reviews.length >= limit);
    return { reviews, aggregate: Array.isArray(payload) ? null : payload?.aggregate || null, partial };
  }

  async function fetchSubmissionConfig(source) {
    const response = await fetch(source, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`API вернул ${response.status}`);
    }
    return response.json();
  }

  function canLoadMore(state) {
    return Boolean(state.fullFeedSource && !state.fullFeedExhausted && !state.fullFeedStalled && !state.loading && !state.destroyed);
  }

  function cancelMoreReviews(state) {
    state.fullFeedController?.abort();
    state.fullFeedController = null;
    state.loadingMore = false;
    if (state.reviewsView) state.reviewsView.scanning = null;
  }

  async function loadMoreReviews(root, state) {
    if (!canLoadMore(state) || state.loadingMore || !root.isConnected) return false;
    const controller = new AbortController();
    state.fullFeedController = controller;
    state.loadingMore = true;
    state.moreError = "";
    render(root, state);
    try {
      const payload = await fetchReviews(pagedSource(state.fullFeedSource, state.fullFeedOffset, state.fullFeedLimit, state._publicKey), controller.signal);
      if (controller.signal.aborted || state.destroyed || !root.isConnected || state.fullFeedController !== controller) return false;
      const existing = new Set(state.rawReviews.map(reviewKey));
      let advanced = false;
      const nextRaw = payload.reviews.filter((review) => {
        const key = reviewKey(review);
        if (!state.fullFeedSeen.has(key)) advanced = true;
        state.fullFeedSeen.add(key);
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });
      state.rawReviews = state.rawReviews.concat(nextRaw);
      state.reviews = state.reviews.concat(normalizeReviews(nextRaw, state.config));
      if (payload.reviews.length < state.fullFeedLimit) state.fullFeedExhausted = true;
      else if (!advanced) {
        state.fullFeedStalled = true;
        state.moreError = "Источник повторяет уже загруженные отзывы. Повторите загрузку позже.";
      }
      if (!state.fullFeedStalled) state.fullFeedOffset += payload.reviews.length;
      if (!state.reviewsView && state.config.layout.mode !== "carousel") state.visible += state.config.layout.pageSize;
      state.loadingMore = false;
      state.fullFeedController = null;
      render(root, state);
      return !state.fullFeedStalled;
    } catch (error) {
      if (controller.signal.aborted || state.destroyed || !root.isConnected || state.fullFeedController !== controller) return false;
      state.loadingMore = false;
      state.fullFeedController = null;
      state.moreError = error.message || "Не удалось загрузить отзывы";
      render(root, state);
      return false;
    } finally {
      if (state.fullFeedController === controller) {
        state.loadingMore = false;
        state.fullFeedController = null;
      }
    }
  }

  function pagedSource(source, offset, limit, publicKey) {
    const url = new URL(source, window.location.href);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", String(limit));
    if (publicKey && !url.searchParams.has("public_key")) url.searchParams.set("public_key", publicKey);
    return url.toString();
  }

  function reviewKey(review) {
    if (review.id != null) {
      return `id:${review.id}`;
    }
    if (review.marketplace && review.externalReviewId) {
      return `${review.marketplace}:${review.externalReviewId}`;
    }
    const date = review.createdAt instanceof Date ? review.createdAt : new Date(review.createdAt);
    return `${review.marketplace || ""}:${review.externalProductId || ""}:${Number.isFinite(date.getTime()) ? date.toISOString() : ""}:${review.authorName || ""}`;
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
    if (defaults.marketplace !== "all" && review.marketplace !== defaults.marketplace) return false;
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

  function renderMarketplaceLabel(marketplace, config, customLabel) {
    const policy = marketplacePolicyFor(marketplace, config);
    const label = policy.label || customLabel || labelMarketplace(marketplace) || "";
    if (config.appearance.marketplaceDisplay !== "icons" || policy.label || !Object.hasOwn(marketplaceLabels, marketplace) || (customLabel && customLabel !== marketplaceLabels[marketplace])) {
      return escapeHTML(label);
    }
    return `<img class="rw-marketplace-icon" src="${escapeAttribute(`${marketplaceIconBase}${marketplace}.png`)}" alt="${escapeAttribute(label)}" title="${escapeAttribute(label)}" width="20" height="20">`;
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
    if (widgetScriptURL) {
      const href = new URL("./assets/fonts/fonts.css", widgetScriptURL).href;
      const doc = host.ownerDocument;
      if (!Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).some((link) => link.href === href)) {
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        doc.head.appendChild(link);
      }
    }

    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    const previousRoot = shadow.querySelector(".reviews-widget-root");
    if (previousRoot && previousRoot.__reviewsWidget) previousRoot.__reviewsWidget.destroy();
    shadow.innerHTML = "";

    if (options.styleText) {
      const style = document.createElement("style");
      style.textContent = options.styleText;
      shadow.appendChild(style);
    }

    const root = document.createElement("div");
    root.className = "reviews-widget reviews-widget-root";
    shadow.appendChild(root);

    return mount(root, options);
  }

  window.ReviewsWidget = {
    mount,
    mountShadow,
    sampleReviews,
    defaultConfig,
    mediaProxyURL,
  };
})();
