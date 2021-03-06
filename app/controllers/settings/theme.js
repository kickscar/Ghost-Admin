/* eslint-disable ghost/ember/alias-model-in-controller */
import Controller from '@ember/controller';
import {isEmpty} from '@ember/utils';
import {isThemeValidationError} from 'ghost-admin/services/ajax';
import {notEmpty} from '@ember/object/computed';
import {inject as service} from '@ember/service';

export const MARKETPLACE_THEMES = [{
    name: 'Edition',
    category: 'Newsletter',
    url: 'https://github.com/TryGhost/Edition',
    previewUrl: 'https://ghost.org/themes/edition',
    ref: 'TryGhost/Edition',
    image: 'assets/img/themes/Edition.jpg',
    shortImage: 'assets/img/themes/Edition-cut.jpg'
}, {
    name: 'Alto',
    category: 'Blog',
    url: 'https://github.com/TryGhost/Alto',
    previewUrl: 'https://ghost.org/themes/alto',
    ref: 'TryGhost/Alto',
    image: 'assets/img/themes/Alto.jpg',
    shortImage: 'assets/img/themes/Alto-cut.jpg'
}, {
    name: 'London',
    category: 'Photography',
    url: 'https://github.com/TryGhost/London',
    previewUrl: 'https://ghost.org/themes/london',
    ref: 'TryGhost/London',
    image: 'assets/img/themes/London.jpg',
    shortImage: 'assets/img/themes/London-cut.jpg'
}, {
    name: 'Ease',
    category: 'Documentation',
    url: 'https://github.com/TryGhost/Ease',
    previewUrl: 'https://ghost.org/themes/ease',
    ref: 'TryGhost/Ease',
    image: 'assets/img/themes/Ease.jpg',
    shortImage: 'assets/img/themes/Ease-cut.jpg'
}];

export default Controller.extend({
    config: service(),
    ghostPaths: service(),
    limit: service(),
    notifications: service(),
    session: service(),
    settings: service(),
    utils: service(),

    dirtyAttributes: false,
    newNavItem: null,
    newSecondaryNavItem: null,
    themes: null,
    themeToDelete: null,
    displayUpgradeModal: false,
    limitErrorMessage: null,

    init() {
        this._super(...arguments);
        this.marketplaceThemes = MARKETPLACE_THEMES;
    },

    showDeleteThemeModal: notEmpty('themeToDelete'),

    actions: {
        async activateTheme(theme) {
            const isOverLimit = await this.limit.checkWouldGoOverLimit('customThemes', {value: theme.name});
            if (isOverLimit) {
                try {
                    await this.limit.limiter.errorIfWouldGoOverLimit('customThemes', {value: theme.name});
                    this.limitErrorMessage = null;
                } catch (error) {
                    if (error.errorType !== 'HostLimitError') {
                        throw error;
                    }

                    this.limitErrorMessage = error.message;
                }

                this.set('displayUpgradeModal', true);
                return;
            }
            return theme.activate().then((activatedTheme) => {
                if (!isEmpty(activatedTheme.get('warnings'))) {
                    this.set('themeWarnings', activatedTheme.get('warnings'));
                    this.set('showThemeWarningsModal', true);
                }

                if (!isEmpty(activatedTheme.get('errors'))) {
                    this.set('themeErrors', activatedTheme.get('errors'));
                    this.set('showThemeWarningsModal', true);
                }
            }).catch((error) => {
                if (isThemeValidationError(error)) {
                    let errors = error.payload.errors[0].details.errors;
                    let fatalErrors = [];
                    let normalErrors = [];

                    // to have a proper grouping of fatal errors and none fatal, we need to check
                    // our errors for the fatal property
                    if (errors.length > 0) {
                        for (let i = 0; i < errors.length; i += 1) {
                            if (errors[i].fatal) {
                                fatalErrors.push(errors[i]);
                            } else {
                                normalErrors.push(errors[i]);
                            }
                        }
                    }

                    this.set('themeErrors', normalErrors);
                    this.set('themeFatalErrors', fatalErrors);
                    this.set('showThemeErrorsModal', true);
                    return;
                }

                throw error;
            });
        },

        downloadTheme(theme) {
            this.utils.downloadFile(`${this.get('ghostPaths.apiRoot')}/themes/${theme.name}/download/`);
        },

        deleteTheme(theme) {
            if (theme) {
                return this.set('themeToDelete', theme);
            }

            return this._deleteTheme();
        },

        hideDeleteThemeModal() {
            this.set('themeToDelete', null);
        },

        hideThemeWarningsModal() {
            this.set('themeWarnings', null);
            this.set('themeErrors', null);
            this.set('themeFatalErrors', null);
            this.set('showThemeWarningsModal', false);
            this.set('showThemeErrorsModal', false);
        },

        hideUpgradeModal() {
            this.set('displayUpgradeModal', false);
        },

        reset() {}
    },

    _deleteTheme() {
        let theme = this.store.peekRecord('theme', this.themeToDelete.name);

        if (!theme) {
            return;
        }

        return theme.destroyRecord().then(() => {
            // HACK: this is a private method, we need to unload from the store
            // here so that uploading another theme with the same "id" doesn't
            // attempt to update the deleted record
            theme.unloadRecord();
        }).catch((error) => {
            this.notifications.showAPIError(error);
        });
    }
});
