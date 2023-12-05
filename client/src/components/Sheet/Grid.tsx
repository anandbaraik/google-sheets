import { useEffect, useRef, MouseEvent, WheelEvent, Fragment } from "react";
import useSheet from "@/hooks/useSheet";
import HighlightCell from "./HighLightCell";
import ColumnResizer from "./ColumnResizer";
import RowResizer from "./RowResizer";
import HighLightSearch from "./HighLightSearch";
import HighLightColumn from "./HighLightColumn";
import HighLightRow from "./HighLightRow";
import ColumnOverLay from "./ColumnOverLay";
import RowOverLay from "./RowOverLay";
import ScrollBar from "./ScrollBar";
import EditCell from "./EditCell";
import ContextMenu from "./ContextMenu";
import Loader from "./Loader";
import { convertToTitle } from "@/utils";

const Grid = () => {
  const gridRef = useRef<HTMLDivElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const verticalScroll = useRef<HTMLDivElement | null>(null);

  const horizontalScroll = useRef<HTMLDivElement | null>(null);

  const {
    grid,
    config,
    isLoading,
    syncState,
    editCell,
    selectedCell,
    selectedColumn,
    selectedRow,
    highLightCellIds,
    contextMenuRect,
    setGrid,
    getCellById,
    getColumnById,
    getRowById,
    setContextMenuRect,
    setSelectedCellId,
    setEditCell,
    setSelectedColumnId,
    setSelectedRowId,
    handleDeleteCell,
    handleDeleteColumn,
    handleDeleteRow,
    handleInsertColumn,
    handleInsertRow,
    handleCopyCell,
    handleCutCell,
    handlePasteCell,
    handleResizeRow,
    handleResizeColumn,
  } = useSheet();

  let { rows, columns } = grid;

  useEffect(() => {
    checkFontsLoaded();
  }, []);

  useEffect(() => {
    if (!syncState) return;
    handleResizeGrid();
  }, [syncState]);

  useEffect(() => {
    window.addEventListener("resize", handleResizeGrid);
    return () => {
      window.removeEventListener("resize", handleResizeGrid);
    };
  }, [grid]);

  useEffect(() => {
    if (!selectedCell && !selectedColumn && !selectedRow) return;
    paintHeaders(rows, columns);
  }, [selectedCell, selectedColumn, selectedRow]);

  const checkFontsLoaded = async () => {
    await document.fonts.ready;
    handleResizeGrid();
  };

  const handleResizeGrid = () => {
    if (!gridRef.current || !canvasRef.current) return;

    let { clientWidth, clientHeight } = gridRef.current;

    let canvas = canvasRef.current;
    canvas.width = clientWidth;
    canvas.height = clientHeight;

    let { rowId = 1, y = config.rowHeight } = rows[0] ?? {};
    let { columnId = 1, x = config.colWidth } = columns[0] ?? {};

    renderGrid({
      offsetX: x,
      offsetY: y,
      rowStart: rowId,
      colStart: columnId,
    });
  };

  const paintRow = (
    ctx: CanvasRenderingContext2D,
    highlight: boolean,
    { height, rowId, width, x, y }: IRow
  ) => {
    paintRect(ctx, highlight ? "#D3E3FD" : "#FFFFFF", { height, width, x, y });

    ctx.save();
    ctx.strokeStyle = config.strokeStyle;
    ctx.lineWidth = config.lineWidth;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "12px Open Sans Medium";
    ctx.fillStyle = highlight ? "#000000" : "#575a5a";
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.stroke();
    ctx.fillText(rowId.toString(), x + width / 2 + 1, y + height / 2 + 1);
    ctx.restore();
  };

  const paintColumn = (
    ctx: CanvasRenderingContext2D,
    highlight: boolean,
    { columnId, height, width, x, y }: IColumn
  ) => {
    paintRect(ctx, highlight ? "#D3E3FD" : "#FFFFFF", { height, width, x, y });
    ctx.save();
    ctx.strokeStyle = config.strokeStyle;
    ctx.lineWidth = config.lineWidth;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "12px Open Sans Medium";
    ctx.fillStyle = highlight ? "#000000" : "#575a5a";
    ctx.beginPath();
    ctx.moveTo(x + width, y);
    ctx.lineTo(x + width, y + height);
    ctx.stroke();
    ctx.fillText(
      convertToTitle(columnId),
      x + width / 2 + 1,
      y + height / 2 + 1
    );
    ctx.restore();
  };

  const paintRect: IPaintRect = (
    ctx,
    backgroundColor,
    { x, y, height, width }
  ) => {
    ctx.save();
    ctx.fillStyle = backgroundColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.fillRect(x, y, width, height);
    ctx.fill();
    ctx.restore();
  };

  const paintCellLine: IPaintCellLine = (ctx, { height, width, x, y }) => {
    ctx.save();
    ctx.strokeStyle = config.strokeStyle;
    ctx.lineWidth = config.lineWidth;
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + width, y);
    ctx.stroke();
    ctx.restore();
  };

  const paintCellContent: IPaintCellContent = (
    ctx,
    content,

    { height, width, x, y }
  ) => {
    if (!canvasRef.current || !content?.length) return;

    const fontOffset = 20;
    let offsetX = x + 5;
    let offsetY = y + fontOffset;

    for (let ops of content) {
      if (ops.insert === "\n") {
        offsetY += fontOffset;
        offsetX = x + 5;
        continue;
      }

      let {
        attributes: {
          strike = false,
          color = "#000000",
          bold = false,
          italic = false,
          underline = false,
          font = "open-sans",
          size = "15px",
        } = {},
        insert,
      } = ops;

      ctx.save();

      let fontStyle = "";

      ctx.fillStyle = color;
      if (bold) fontStyle += "bold ";
      if (italic) fontStyle += "italic ";
      fontStyle += `${size} ${config.fonts[font]}`;
      ctx.font = fontStyle;

      let { width } = ctx.measureText(insert);

      ctx.fillText(insert, offsetX, offsetY);

      if (underline || strike) {
        ctx.save();
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = color || "#000000";
        if (underline) ctx.strokeRect(offsetX, offsetY + 2, width, 0);
        if (strike) ctx.strokeRect(offsetX, offsetY - 5, width, 0);
        ctx.restore();
      }

      offsetX += width;

      ctx.restore();
    }
  };

  const paintCell: IPaintCell = (
    ctx,
    { cellId, rowId, columnId, height, width, x, y }
  ) => {
    let { background = "#FFFFFF", content = [] } = getCellById(cellId) ?? {};

    let rect = { x, y, width, height };

    paintRect(ctx, background, rect);
    paintCellContent(ctx, content, rect);
    paintCellLine(ctx, rect);
  };

  const paintBox = () => {
    if (!canvasRef.current) return;

    let ctx = canvasRef.current.getContext("2d")!;
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = config.strokeStyle;
    ctx.lineWidth = config.lineWidth - 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.fillRect(0, 0, config.colWidth, config.rowHeight);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.strokeRect(0, 1, config.colWidth, config.rowHeight - 1);
    ctx.stroke();
    ctx.restore();
  };

  const paintRows = (rows: IRow[]) => {
    if (!canvasRef.current || !rows.length) return;

    let ctx = canvasRef.current.getContext("2d")!;

    let activeRowId = selectedCell?.rowId;

    for (let row of rows) {
      let highlight = row.rowId === activeRowId || !!selectedColumn;
      paintRow(ctx, highlight, row);
    }

    ctx.save();
    ctx.strokeStyle = config.strokeStyle;
    ctx.lineWidth = config.lineWidth - 0.5;
    ctx.beginPath();
    ctx.moveTo(0, config.rowHeight);
    ctx.lineTo(0, canvasRef.current.clientHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(config.colWidth, config.rowHeight);
    ctx.lineTo(config.colWidth, canvasRef.current.clientHeight);
    ctx.stroke();
    ctx.restore();
  };

  const paintColumns = (columns: IColumn[]) => {
    if (!canvasRef.current || !columns.length) return;

    let ctx = canvasRef.current.getContext("2d")!;

    let activeColumnId = selectedCell?.columnId;

    for (let column of columns) {
      let highlight = column.columnId === activeColumnId || !!selectedRow;
      paintColumn(ctx, highlight, column);
    }

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = config.strokeStyle;
    ctx.lineWidth = config.lineWidth - 0.5;
    ctx.moveTo(config.colWidth, config.rowHeight);
    ctx.lineTo(canvasRef.current.clientWidth, config.rowHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(config.colWidth, 1);
    ctx.lineTo(canvasRef.current.clientWidth, 1);
    ctx.stroke();
    ctx.restore();
  };

  const paintHeaders = (rows: IRow[], columns: IColumn[]) => {
    paintRows(rows);
    paintColumns(columns);
    paintBox();
  };

  const renderGrid: IRenderGrid = ({
    offsetX,
    offsetY,
    rowStart,
    colStart,
  }) => {
    if (!gridRef.current || !canvasRef.current) return;

    let ctx = canvasRef.current.getContext("2d")!;
    let { clientWidth, clientHeight } = gridRef.current;

    ctx.clearRect(0, 0, clientWidth, clientHeight);

    let rowData: IRow[] = [];
    let columnData: IColumn[] = [];
    let cellData: ICell[] = [];

    for (let i = rowStart, y = offsetY; y < clientHeight; i++) {
      let height = getRowById(i)?.height || config.cellHeight;

      if (y + height > config.rowHeight) {
        rowData.push({
          y,
          x: 0,
          rowId: i,
          height: height,
          width: config.colWidth,
        });
      }

      y += height;
    }

    for (let i = colStart, x = offsetX; x < clientWidth; i++) {
      let width = getColumnById(i)?.width || config.cellWidth;

      if (x + width > config.colWidth) {
        columnData.push({
          x,
          y: 0,
          columnId: i,
          width,
          height: config.rowHeight,
        });
      }

      x += width;
    }

    for (let { rowId, height, y } of rowData) {
      for (let { width, x, columnId } of columnData) {
        let cellId = `${columnId},${rowId}`;

        cellData.push({
          x,
          y,
          rowId,
          columnId,
          width,
          height,
          cellId,
        });

        paintCell(ctx, cellData.at(-1)!);
      }
    }

    paintHeaders(rowData, columnData);

    setGrid({
      cells: cellData,
      columns: columnData,
      rows: rowData,
    });
  };

  const handleVerticalScroll = (deltaY: number) => {
    if (!gridRef || !rows.length || !columns.length) return;

    let { rowId, y } = rows[0];
    let { columnId, x } = columns[0];

    if (deltaY < 0) {
      // Scroll upwards
      y += -deltaY;
      rowId--;

      while (rowId > 0 && y > config.rowHeight) {
        y -= getRowById(rowId)?.height ?? config.cellHeight;
        rowId--;
      }

      let offsetY = Math.min(config.rowHeight, y);

      renderGrid({
        offsetX: x,
        offsetY,
        rowStart: rowId + 1,
        colStart: columnId,
      });
    } else {
      // Scroll downwards
      renderGrid({
        offsetX: x,
        offsetY: y + -deltaY,
        rowStart: rowId,
        colStart: columnId,
      });
    }

    // if (!verticalScroll.current) return;

    // let top = +verticalScroll.current.style.top.replace("px", "");
    // verticalScroll.current.style.top = `${top + deltaY}px`;
  };

  const handleHorizontalScroll = (deltaX: number) => {
    if (!gridRef || !rows.length || !columns.length) return;

    let { rowId, y } = rows[0];
    let { columnId, x } = columns[0];

    if (deltaX < 0) {
      // Scroll leftwards
      x += -deltaX;
      columnId--;

      while (columnId > 0 && x > config.colWidth) {
        x -= getColumnById(columnId)?.width ?? config.cellWidth;
        columnId--;
      }

      renderGrid({
        offsetX: Math.min(config.colWidth, x),
        offsetY: y,
        rowStart: rowId,
        colStart: columnId + 1,
      });
    } else {
      // Scroll rightwards
      renderGrid({
        offsetX: x + -deltaX,
        offsetY: y,
        rowStart: rowId,
        colStart: columnId,
      });
    }

    // if (!horizontalScroll.current) return;

    // let left = +horizontalScroll.current.style.left.replace("px", "");
    // horizontalScroll.current.style.left = `${left + deltaX}px`;
  };

  const handleScroll = (event: any) => {
    let { deltaX, deltaY } = event as WheelEvent;

    if (deltaX === 0) handleVerticalScroll(deltaY);
    else handleHorizontalScroll(deltaX);
  };

  const handleClickGrid = (event: MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current) return;

    let x = event.pageX;
    let y = event.pageY - gridRef.current.getBoundingClientRect().top;

    let cellId = getCellIdByCoordiantes(x, y);

    if (!cellId) return;

    setSelectedCellId(cellId);
    setEditCell(null);
    setSelectedColumnId(null);
    setSelectedRowId(null);
    setContextMenuRect(null);
  };

  const getCellIdByCoordiantes = (x: number, y: number) => {
    let left = 0;
    let right = rows.length - 1;
    let rowId = null;

    while (left <= right) {
      let mid = Math.floor((left + right) / 2);

      if (rows[mid].y <= y) {
        left = mid + 1;
        rowId = rows[mid].rowId;
      } else {
        right = mid - 1;
      }
    }

    if (!rowId) return null;

    left = 0;
    right = columns.length - 1;
    let columnId = null;

    while (left <= right) {
      let mid = Math.floor((left + right) / 2);

      if (columns[mid].x <= x) {
        left = mid + 1;
        columnId = columns[mid].columnId;
      } else {
        right = mid - 1;
      }
    }

    if (!columnId) return null;

    return `${columnId},${rowId}`;
  };

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleClickGrid(event);
    setContextMenuRect({ x: event.pageX, y: event.pageY });
  };

  const handleDoubleClickCell = () => {
    if (!gridRef.current || !selectedCell) return;

    let { columnId, cellId, width, height, rowId, x, y } = selectedCell;

    let { top } = gridRef.current.getBoundingClientRect();

    setSelectedCellId(null);
    setEditCell({
      cellId,
      columnId,
      width,
      height,
      rowId,
      x: Math.max(config.colWidth, x),
      y: Math.max(config.rowHeight + top, y + top),
    });
  };

  const handleClickColumn = (columnId: number) => {
    setSelectedColumnId(columnId);
    setSelectedRowId(null);
    setSelectedCellId(null);
    setEditCell(null);
    setContextMenuRect(null);
  };

  const handleClickRow = (rowId: number) => {
    setSelectedRowId(rowId);
    setSelectedColumnId(null);
    setSelectedCellId(null);
    setEditCell(null);
    setContextMenuRect(null);
  };

  return (
    <Fragment>
      <div
        ref={gridRef}
        className="relative w-[var(--grid-width)] h-[var(--grid-height)] select-none overflow-hidden"
        onWheel={handleScroll}
        onClick={handleClickGrid}
        onContextMenu={handleContextMenu}
      >
        {isLoading && <Loader />}
        <canvas ref={canvasRef}></canvas>
        <ScrollBar ref={verticalScroll} axis="y" />
        <ScrollBar ref={horizontalScroll} axis="x" />
        {selectedColumn && <HighLightColumn column={selectedColumn} />}
        {selectedRow && <HighLightRow row={selectedRow} />}
        <div className="absolute left-[var(--col-width)] top-[var(--row-height)] w-[calc(100%-var(--col-width))] h-[calc(100%-var(--row-height))] overflow-hidden">
          {selectedCell && !editCell && (
            <HighlightCell
              cell={selectedCell}
              onDoubleClick={handleDoubleClickCell}
            />
          )}
          {selectedColumn && <ColumnOverLay column={selectedColumn} />}
          {selectedRow && <RowOverLay row={selectedRow} />}
          {!!highLightCellIds.length && <HighLightSearch />}
        </div>
        <ColumnResizer
          columns={columns}
          onClick={handleClickColumn}
          onResize={handleResizeColumn}
        />
        <RowResizer
          rows={rows}
          onClick={handleClickRow}
          onResize={handleResizeRow}
        />
      </div>
      <EditCell cell={editCell} data={getCellById(editCell?.cellId)} />
      {contextMenuRect && (
        <ContextMenu
          rect={contextMenuRect}
          onCopy={handleCopyCell}
          onCut={handleCutCell}
          onPaste={handlePasteCell}
          onDeleteCell={handleDeleteCell}
          onDeleteColumn={handleDeleteColumn}
          onDeleteRow={handleDeleteRow}
          onInsertColumn={handleInsertColumn}
          onInsertRow={handleInsertRow}
        />
      )}
    </Fragment>
  );
};

export default Grid;
