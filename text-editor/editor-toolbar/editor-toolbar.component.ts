import {
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  output,
  Renderer2,
  signal,
} from '@angular/core';
import { CustomClass, SelectOption } from '../../../interfaces/editor-config.interface';
import { EditorService } from '../../../services/editor.service';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { ToolbarSetComponent } from '../toolbar-set/toolbar-set.component';

@Component({
  selector: 'app-editor-toolbar',
  imports: [Button, Select, FormsModule, ToolbarSetComponent],
  templateUrl: './editor-toolbar.component.html',
  styleUrl: './editor-toolbar.component.scss',
})
export class EditorToolbarComponent {
  private readonly r = inject(Renderer2);
  private readonly editorService = inject(EditorService);
  private readonly doc = inject(DOCUMENT);

  id = input<string>();
  uploadUrl = input<string>();
  showToolbar = input<boolean>();
  fonts = input<SelectOption[]>([{ label: '', value: '' }]);
  customClasses = input<CustomClass[]>();
  defaultFontName = input<string>();
  defaultFontSize = input<string>();
  disabled = input<boolean>();
  isVertical = input<boolean>();
  execute = output<string>();

  selectedFontSize = signal<string>(null);
  selectedFontName = signal<string>(null);

  fontName = computed(() => this.selectedFontName() ?? this.defaultFontName() ?? 'Arial');
  fontSize = computed(() => this.selectedFontSize() ?? this.defaultFontSize() ?? '3');

  htmlMode = false;
  linkSelected = false;
  block = 'default';
  foreColour: string;
  backColor: string;

  headings: SelectOption[] = [
    {
      label: 'Heading 1',
      value: 'h1',
    },
    {
      label: 'Heading 2',
      value: 'h2',
    },
    {
      label: 'Heading 3',
      value: 'h3',
    },
    {
      label: 'Paragraph',
      value: 'p',
    },
    {
      label: 'Standard',
      value: 'div',
    },
  ];

  customClassId = '-1';

  select = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'PRE', 'DIV'];

  buttons = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'];

  customClassList = computed(() => {
    const classes = this.customClasses();
    const classOptions =
      classes?.map((cc, i) => ({
        label: cc.name,
        value: i.toString(),
      })) ?? [];

    return [{ label: 'Clear Class', value: '-1' }, ...classOptions];
  });
  get isLinkButtonDisabled(): boolean {
    return this.htmlMode || !Boolean(this.editorService.selectedText);
  }

  /**
   * Trigger command from editor header buttons
   * @param command string from toolbar buttons
   */
  triggerCommand(command: string) {
    this.execute.emit(command);
  }

  /**
   * highlight editor buttons when cursor moved or positioning
   */
  triggerButtons() {
    if (!this.showToolbar()) {
      return;
    }
    this.buttons.forEach(e => {
      const result = this.doc.queryCommandState(e);
      const elementById = this.doc.getElementById(e + '-' + this.id());
      if (result) {
        this.r.addClass(elementById, 'active');
      } else {
        this.r.removeClass(elementById, 'active');
      }
    });
  }

  /**
   * trigger highlight editor buttons when cursor moved or positioning in block
   */
  triggerBlocks(nodes: Node[]) {
    if (!this.showToolbar()) {
      return;
    }
    this.linkSelected = nodes.findIndex(x => x.nodeName === 'A') > -1;
    let found = false;
    this.select.forEach(y => {
      const node = nodes.find(x => x.nodeName === y);
      if (node !== undefined && y === node.nodeName) {
        if (found === false) {
          this.block = node.nodeName.toLowerCase();
          found = true;
        }
      } else if (found === false) {
        this.block = 'default';
      }
    });

    found = false;
    if (this.customClasses()) {
      this.customClasses().forEach((y, index) => {
        const node = nodes.find(x => {
          if (x instanceof Element) {
            return x.className === y.class;
          }
        });
        if (node !== undefined) {
          if (found === false) {
            this.customClassId = index.toString();
            found = true;
          }
        } else if (found === false) {
          this.customClassId = '-1';
        }
      });
    }

    this.foreColour = this.doc.queryCommandValue('ForeColor');
    this.selectedFontSize.set(this.doc.queryCommandValue('FontSize'));
    this.selectedFontName.set(this.doc.queryCommandValue('FontName').replace(/"/g, ''));
    this.backColor = this.doc.queryCommandValue('backColor');
  }

  /**
   * toggle editor mode (WYSIWYG or SOURCE)
   * @param m boolean
   */
  setEditorMode(m: boolean) {
    const toggleEditorModeButton = this.doc.getElementById('toggleEditorMode' + '-' + this.id());
    if (m) {
      this.r.addClass(toggleEditorModeButton, 'active');
    } else {
      this.r.removeClass(toggleEditorModeButton, 'active');
    }
    this.htmlMode = m;
  }

  /**
   * Set custom class
   */
  setCustomClass(classId: string) {
    if (classId === '-1') {
      this.execute.emit('clear');
    } else {
      this.editorService.createCustomClass(this.customClasses()[+classId]);
    }
  }
}
