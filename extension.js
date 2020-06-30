const Lang = imports.lang;
const GObject = imports.gi.GObject
const Gio = imports.gi.Gio
const Gtk = imports.gi.Gtk
const GLib = imports.gi.GLib
const St = imports.gi.St

const Main = imports.ui.main
const PanelMenu = imports.ui.panelMenu
const PopupMenu = imports.ui.popupMenu

const Util = imports.misc.util
const Self = imports.misc.extensionUtils.getCurrentExtension()
const Utils = Self.imports.utils

const TIMER = {
  seconds: 0,
  running: true,
}

const setPanelTransparency = function (enabled) {
  let removedClass = enabled ? "solid" : "panel-semi-transparent"
  let addedClass = enabled ? "panel-semi-transparent" : "solid"
  let setFor = function (panel) {
    panel.add_style_class_name(addedClass)
    panel.remove_style_class_name(removedClass)
  }

  setFor(Main.panel)

  if (Main.mmPanel)
    for (var i = 0, len = Main.mmPanel.length; i < len; i++)
      setFor(Main.mmPanel[i])
}

var WallpaperModeExtension = GObject.registerClass(
  class WallpaperModeExtension extends GObject.Object {
    _init() {
      this.settings = Utils.getSettings()

      this.settings.connect('changed::seconds', Lang.bind(this, this._applyTimer))
      this.settings.connect('changed::provider', Lang.bind(this, this._applyProvider))
      this.settings.connect('changed::bar-actor', Lang.bind(this, this._reloadPanelMenu))
      this.settings.connect('changed::semitransparent-bar', Lang.bind(this, this._reloadTransparency))
    }

    activate() {
      TIMER.running = true;

      this._reloadPanelMenu()
      this._reloadTransparency()
      this._applyTimer()
      this._applyProvider()
    }

    deactivate() {
      TIMER.running = false;

      this._resetTimer()
      this._destroyPanelMenu()
      this._destroyTransparency()
    }

    _nextWallpaper() {
      this.provider.next(Lang.bind(this, this._setWallpaper))
      this._resetTimer()
    }

    _destroyPanelMenu() {
      if (this.panelEntry != null) {
        this.panelEntry.destroy()
        this.panelEntry = null
      }
    }

    _destroyTransparency() {
      setPanelTransparency(false)

      if (this.transparencyHandlerId != undefined) {
        global.window_manager.disconnect(this.transparencyHandlerId)
        this.transparencyHandlerId = undefined
      }
    }

    _openSettings() {
      Util.spawn(['gnome-shell-extension-prefs', Self.uuid])
    }

    _pauseToggle() {
      TIMER.running = !TIMER.running
      this.panelEntry.reloadPauseState()
      this._resetTimer()
    }

    _applyProvider() {
      this.provider = Utils.getProvider(this.settings.get_string('provider'))
      this._nextWallpaper()
      this.provider.connect('wallpapers-changed', Lang.bind(this, function (provider) {
        if (provider === this.provider)
          this._nextWallpaper()
      }))
    }

    _applyTimer() {
      TIMER.seconds = this.settings.get_int('seconds')
      this._resetTimer()
    }

    _resetTimer() {
      if (this.timer)
        GLib.Source.remove(this.timer)

      if (TIMER.running && TIMER.seconds > 0) {
        this.timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, TIMER.seconds,
          Lang.bind(this, function () {
            this.timer = null
            this._nextWallpaper()
            return false
          })
        )
      } else {
        this.timer = null
      }
    }

    _reloadPanelMenu() {
      let enabled = this.settings.get_boolean('bar-actor')

      if (enabled && this.panelEntry != null)
        return false

      if (enabled) {
        this.panelEntry = new WallpaperModeEntry(this)
        Main.panel.addToStatusArea('wallpaper-mode-menu', this.panelEntry)
      } else {
        this._destroyPanelMenu()
      }

      return true
    }

    _reloadTransparency() {
      let enabled = this.settings.get_boolean('semitransparent-bar')

      if (enabled) {
        setPanelTransparency(true)

        if (this.transparencyHandlerId == undefined)
          this.transparencyHandlerId = global.window_manager.connect('switch-workspace', () => setPanelTransparency(true))
      } else
        this._destroyTransparency()
    }

    _setWallpaper(path) {
      const background_setting = new Gio.Settings({ schema: 'org.gnome.desktop.background' })

      if (background_setting.is_writable('picture-uri')
        && background_setting.set_string('picture-uri', 'file://' + path))
        Gio.Settings.sync()
    }
  }
)

const WallpaperModeEntry = new Lang.Class({
  Name: "WallpaperModeEntry",
  Extends: PanelMenu.Button,

  _init: function (extension) {
    this.parent(0, 'WallpaperModeEntry')

    const icon = new St.Icon({
      icon_name: 'preferences-desktop-wallpaper-symbolic',
      style_class: 'system-status-icon'
    })

    this.add_child(icon)

    // Construct items
    this.nextItem = new PopupMenu.PopupMenuItem('Next Wallpaper')
    this.settingsItem = new PopupMenu.PopupMenuItem('Settings')
    this.separatorItem = new PopupMenu.PopupSeparatorMenuItem('')
    this.pauseItem = new PopupMenu.PopupMenuItem('Pause')

    // Add items to menu
    this.menu.addMenuItem(this.nextItem)
    this.menu.addMenuItem(this.pauseItem)
    this.menu.addMenuItem(this.separatorItem)
    this.menu.addMenuItem(this.settingsItem)

    // Bind events
    this.settingsItem.connect('activate', Lang.bind(extension, extension._openSettings))
    this.nextItem.connect('activate', Lang.bind(extension, extension._nextWallpaper))
    this.pauseItem.connect('activate', Lang.bind(extension, extension._pauseToggle))

    this.reloadPauseState()
  },

  reloadPauseState: function () {
    this.pauseItem.label.set_text(TIMER.running ? 'Pause' : 'Unpause')
  }
});

function init() {
  global.wallpaperMode = new WallpaperModeExtension()
}

function enable() {
  global.wallpaperMode.activate()
}

function disable() {
  global.wallpaperMode.deactivate()
}