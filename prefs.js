const Lang = imports.lang

const Gtk = imports.gi.Gtk
const Gio = imports.gi.Gio

const Self = imports.misc.extensionUtils.getCurrentExtension()
const Utils = Self.imports.utils

let settings

function init() {
  settings = Utils.getSettings()
}

function buildPrefsWidget() {
  const main = Gtk.Builder.new_from_file(Self.dir.get_path() + '/preferences/main.ui')
  const widget = main.get_object('prefs_widget')

  const providerList = main.get_object('field_provider')
  for (let provider in Utils.getProviders()) {
    providerList.append(provider, provider)
  }

  settings.bind('seconds', main.get_object('field_seconds'), 'value', Gio.SettingsBindFlags.DEFAULT)
  settings.bind('provider', main.get_object('field_provider'), 'active-id', Gio.SettingsBindFlags.DEFAULT)
  settings.bind('bar-actor', main.get_object('field_bar_actor'), 'active', Gio.SettingsBindFlags.DEFAULT)
  settings.bind('semitransparent-bar', main.get_object('field_semitransparent_bar'), 'active', Gio.SettingsBindFlags.DEFAULT)

  if (providerList.get_active() === -1) {
    providerList.set_active(0)
  }

  _updateProviderTab(main, true)()
  settings.connect('changed::provider', Lang.bind(this, _updateProviderTab(main)))

  widget.show_all()
  return widget
}

function _updateProviderTab(main, dry) {
  return function () {
    const providerPlace = main.get_object('provider_prefs')
    const providerPrefs = Utils.getProvider(settings.get_string('provider')).getPreferences().get_object('prefs_page')
    providerPlace.forall(function (child) {
      providerPlace.remove(child)
      child.destroy()
    })
    if (providerPrefs) {
      const children = []
      providerPrefs.forall(function (child) {
        providerPrefs.remove(child)
        children.unshift(child)
      })
      children.forEach(function (child) {
        providerPlace.add(child)
      })
      if (!dry) {
        providerPlace.show_all()
      }
    }
  }
}