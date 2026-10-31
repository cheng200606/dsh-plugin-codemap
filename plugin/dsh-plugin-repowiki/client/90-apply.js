/* ---- 90-apply.js ----
 * Slot registration and module teardown.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
    function apply(ctx) {
      injectPanelStyles()
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'repo-wiki: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 50,
            label: () => t('panel'),
            locale: NS,
          },
          RepoWikiPanelIcon,
        ),
      )

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
            locale: NS,
          },
          (props) => h(RepoWikiPanel, Object.assign({}, props, { t })),
        ),
      )
    }

    return {
      NS,
      PANEL_ID,
      apply,
      inject,
    }
  },
})
