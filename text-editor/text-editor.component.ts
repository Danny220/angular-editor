import {
  AfterViewInit,
  Attribute,
  Component,
  ContentChild,
  DOCUMENT,
  ElementRef,
  forwardRef,
  HostBinding,
  HostListener,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  Renderer2,
  SecurityContext,
  TemplateRef,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { defaultEditorConfig, EditorConfig } from '../../interfaces/editor-config.interface';
import { DomSanitizer } from '@angular/platform-browser';
import { isDefined } from '../../utilities';
import { EditorService } from '../../services/editor.service';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { EditorToolbarComponent } from './editor-toolbar/editor-toolbar.component';
import { Textarea } from 'primeng/textarea';

@Component({
  selector: 'app-text-editor',
  imports: [NgClass, EditorToolbarComponent, NgTemplateOutlet, Textarea],
  templateUrl: './text-editor.component.html',
  styleUrl: './text-editor.component.scss',
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextEditorComponent),
      multi: true,
    },
    EditorService,
  ],
})
export class TextEditorComponent implements OnInit, ControlValueAccessor, AfterViewInit, OnDestroy {
  private readonly r = inject(Renderer2);
  private readonly editorService = inject(EditorService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly doc = inject(DOCUMENT);

  private onChange: (value: string) => void;
  private onTouched: () => void;

  @ViewChild('editor', { static: true }) textArea: ElementRef;
  @ViewChild('editorWrapper', { static: true }) editorWrapper: ElementRef;
  @ViewChild('editorToolbar') editorToolbar: any; //

  @ContentChild('customButtons') customButtonsTemplateRef?: TemplateRef<any>;

  @HostBinding('attr.tabindex') tabindex = -1;

  id = input('');
  config = input<EditorConfig>(defaultEditorConfig);
  placeholder = input('');

  html = output();
  viewMode = output<boolean>();
  blurEvent = output<FocusEvent>();
  focusEvent = output<FocusEvent>();

  modeVisual = true;
  showPlaceholder = false;
  disabled = false;
  focused = false;
  touched = false;
  changed = false;
  tabIndex = 0;

  focusInstance: any;
  blurInstance: any;

  executeCommandFn = this.executeCommand.bind(this);

  constructor(
    @Attribute('tabindex') defaultTabIndex: string,
    @Attribute('autofocus') private autoFocus: any,
  ) {
    const parsedTabIndex = Number(defaultTabIndex);
    this.tabIndex = parsedTabIndex || parsedTabIndex === 0 ? parsedTabIndex : null;
  }

  ngOnInit() {
    this.config().toolbarPosition =
      this.config().toolbarPosition ?? defaultEditorConfig.toolbarPosition;
  }

  ngAfterViewInit() {
    if (isDefined(this.autoFocus)) {
      this.focus();
    }
  }

  @HostListener('focus')
  onFocus() {
    this.focus();
  }

  onPaste(event: ClipboardEvent) {
    if (this.config().rawPaste) {
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      document.execCommand('insertHTML', false, text);
      return text;
    }
  }

  executeCommand(command: string, value?: string) {
    this.focus();

    if (command === 'focus' || command === '') return;

    switch (command) {
      case 'toggleEditorMode':
        this.toggleEditorMode(this.modeVisual);
        break;
      case 'clear':
        this.editorService.removeSelectedElements(this.getCustomTags());
        this.onContentChange(this.textArea.nativeElement);
        break;
      case 'default':
        this.editorService.removeSelectedElements('h1,h2,h3,h4,h5,h6,p,pre');
        this.onContentChange(this.textArea.nativeElement);
        break;
      default:
        this.editorService.executeCommand(command, value);
        break;
    }

    this.exec();
  }

  onTextAreaFocus(event: FocusEvent) {
    if (this.focused) {
      event.stopPropagation();
      return;
    }
    this.focused = true;
    this.focusEvent.emit(event);
    if (!this.touched || !this.changed) {
      this.configure();
      this.touched = true;
    }
  }

  onTextAreaBlur(event: FocusEvent) {
    const newTarget = event.relatedTarget as HTMLElement;
    if (
      !newTarget ||
      (!newTarget.closest('.ae-non-blur-trigger') &&
        !newTarget.closest('.autocomplete-suggestions'))
    ) {
      this.editorService.saveSelection();
    }

    if (typeof this.onTouched === 'function') {
      this.onTouched();
    }

    if (event.relatedTarget !== null) {
      const target = event.relatedTarget as HTMLElement;
      if (!target.closest('.angular-editor-toolbar') && !target.closest('.ae-picker')) {
        this.blurEvent.emit(event);
        this.focused = false;
      }
    }
  }

  focus() {
    if (this.modeVisual) {
      this.textArea.nativeElement.focus();
    } else {
      const sourceText = this.doc.getElementById('sourceText' + this.id());
      sourceText.focus();
      this.focused = true;
    }
  }

  onContentChange(element: HTMLElement): void {
    let html: string;
    if (this.modeVisual) {
      html = element.innerHTML;
    } else {
      html = element.innerText;
    }
    if (!html || html === '<br>') {
      html = '';
    }
    if (typeof this.onChange === 'function') {
      this.onChange(
        this.config().sanitize || this.config().sanitize === undefined
          ? this.sanitizer.sanitize(SecurityContext.HTML, html)
          : html,
      );
      if (!html !== this.showPlaceholder) {
        this.togglePlaceholder(this.showPlaceholder);
      }
    }
    this.changed = true;
  }

  registerOnChange(fn: any): void {
    this.onChange = e => (e === '<br>' ? fn('') : fn(e));
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  writeValue(value: any): void {
    if ((!value || value === '<br>' || value === '') !== this.showPlaceholder) {
      this.togglePlaceholder(this.showPlaceholder);
    }

    if (value === undefined || value === '' || value === '<br>') {
      value = null;
    }

    this.refreshView(value);
  }

  refreshView(value: string): void {
    const normalizedValue = value === null ? '' : value;
    this.r.setProperty(this.textArea.nativeElement, 'innerHTML', normalizedValue);

    return;
  }

  togglePlaceholder(value: boolean): void {
    if (!value) {
      this.r.addClass(this.editorWrapper.nativeElement, 'show-placeholder');
      this.showPlaceholder = true;
    } else {
      this.r.removeClass(this.editorWrapper.nativeElement, 'show-placeholder');
      this.showPlaceholder = false;
    }
  }

  setDisabledState(isDisabled: boolean): void {
    const div = this.textArea.nativeElement;
    const action = isDisabled ? 'addClass' : 'removeClass';
    this.r[action](div, 'disabled');
    this.disabled = isDisabled;
  }

  toggleEditorMode(bToSource: boolean) {
    let oContent: any;
    const editableElement = this.textArea.nativeElement;

    if (bToSource) {
      oContent = this.r.createText(editableElement.innerHTML);
      this.r.setProperty(editableElement, 'innerHTML', '');
      this.r.setProperty(editableElement, 'contentEditable', false);

      const oPre = this.r.createElement('pre');
      this.r.setStyle(oPre, 'margin', '0');
      this.r.setStyle(oPre, 'outline', 'none');

      const oCode = this.r.createElement('code');
      this.r.setProperty(oCode, 'id', 'sourceText' + this.id());
      this.r.setStyle(oCode, 'display', 'block');
      this.r.setStyle(oCode, 'white-space', 'pre-wrap');
      this.r.setStyle(oCode, 'word-break', 'keep-all');
      this.r.setStyle(oCode, 'outline', 'none');
      this.r.setStyle(oCode, 'margin', '0');
      this.r.setStyle(oCode, 'background-color', '#fff5b9');
      this.r.setProperty(oCode, 'contentEditable', true);
      this.r.appendChild(oCode, oContent);
      this.focusInstance = this.r.listen(oCode, 'focus', event => this.onTextAreaFocus(event));
      this.blurInstance = this.r.listen(oCode, 'blur', event => this.onTextAreaBlur(event));
      this.r.appendChild(oPre, oCode);
      this.r.appendChild(editableElement, oPre);

      this.doc.execCommand('defaultParagraphSeparator', false, 'div');

      this.modeVisual = false;
      this.viewMode.emit(false);
      oCode.focus();
    } else {
      if (this.doc.querySelectorAll) {
        this.r.setProperty(editableElement, 'innerHTML', editableElement.innerText);
      } else {
        oContent = this.doc.createRange();
        oContent.selectNodeContents(editableElement.firstChild);
        this.r.setProperty(editableElement, 'innerHTML', oContent.toString());
      }
      this.r.setProperty(editableElement, 'contentEditable', true);
      this.modeVisual = true;
      this.viewMode.emit(true);
      this.onContentChange(editableElement);
      editableElement.focus();
    }
    this.editorToolbar.setEditorMode(!this.modeVisual);
  }

  exec() {
    this.editorToolbar.triggerButtons();

    let userSelection;
    if (this.doc.getSelection) {
      userSelection = this.doc.getSelection();
      this.editorService.saveSelection();
    }

    let a = userSelection.focusNode;
    const els = [];
    while (a && a.id !== 'editor') {
      els.unshift(a);
      a = a.parentNode;
    }
    this.editorToolbar.triggerBlocks(els);
  }

  getFonts() {
    const fonts = this.config().fonts ? this.config().fonts : defaultEditorConfig.fonts;
    return fonts.map(x => {
      return { label: x.name, value: x.name };
    });
  }

  getCustomTags() {
    const tags = ['span'];
    this.config().customClasses.forEach(x => {
      if (x.tag !== undefined) {
        if (!tags.includes(x.tag)) {
          tags.push(x.tag);
        }
      }
    });
    return tags.join(',');
  }

  filterStyles(html: string): string {
    html = html.replace('position: fixed;', '');
    return html;
  }

  /**
   * Saves the current cursor position or selection
   */
  public saveCursorPosition() {
    this.editorService.saveSelection();
  }

  /**
   * Inserts HTML content at the saved cursor position
   *
   * @poram html HTML content to insert
   */
  public insertAtCursor(html: string) {
    // Calling this.focus() here programmatically can reset the selection that restoreSelection() is about to set.
    // The restoreSelection() method itself is responsible for bringing focus back to the editor
    // by re-applying the saved Range. Removing the explicit focus call makes the insertion more reliable.
    if (this.editorService.restoreSelection()) {
      this.editorService.insertHtml(html);
      this.onContentChange(this.textArea.nativeElement);
    }
  }

  ngOnDestroy() {
    if (this.blurInstance) {
      this.blurInstance();
    }
    if (this.focusInstance) {
      this.focusInstance();
    }
  }

  private configure() {
    if (this.config().defaultParagraphSeparator) {
      this.editorService.setDefaultParagraphSeparator(this.config().defaultParagraphSeparator);
    }
    if (this.config().defaultFontName) {
      this.editorService.setFontName(this.config().defaultFontName);
    }
    if (this.config().defaultFontSize) {
      this.editorService.setFontSize(this.config().defaultFontSize);
    }
  }
}
