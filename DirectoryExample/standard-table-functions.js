
/*
tableId = Table Id

*/


function emptyTable(tableId, schema) 
{
    var table,row,guxTable;
    table = document.createElement("table");
    table.setAttribute('id',tableId);
    guxTable = document.createElement("gux-table");
    guxTable.setAttribute('resizable-columns','');
    guxTable.setAttribute('compact','');
    guxTable.appendChild(table);
    table.setAttribute('slot','data');

    
    

    return guxTable;
}

/*
Schema is an array of objects {"name":"columen name", "id":"id", "type":"column type", "button":true , "onClickAction":"theaction(this)"}
supported types are name and action
*/
function addHeaders(tableElement,schema)
{
    
    var headerRow = tableElement.createTHead().insertRow();
    
    for (let index = 0; index < schema.length; index++) {
        const headerSchemaElement = schema[index];

        let th = document.createElement("th");
        let text = document.createTextNode(headerSchemaElement.name);
        th.setAttribute(`data-column-${headerSchemaElement.type}`,headerSchemaElement.name);
       
        th.appendChild(text);
        if(headerSchemaElement.type == "contextMenu")
        {

        }
        else
        {
            headerRow.appendChild(th);
        }
        
        
    }

    
    

}

function addRow(table,rowId,cellData,schema) 
{

    let row = table.insertRow();
    row.setAttribute('id',rowId);

    for (let index = 0; index < cellData.length; index++) {
        const cell = cellData[index];

        if (schema[index].type == "contextMenu")
        {        
            let newCell = row.insertCell();
            newCell.setAttribute('data-cell-action','');
            newCell.appendChild(createContextMenu(cell,schema[index].items))
        }
        else if (schema[index].button == true)
        {
            
            row.insertCell().appendChild(createGuxButton(cell, rowId + 'button',schema[index].onClickAction));
        }
        else
        {
            row.insertCell().innerHTML = cell;
        }
        
        
    }
}

function createSchema()
{

}

function createGuxButton(text, id, onclickAction, accent = "inline",disabled = 'false')
{
    let Button = document.createElement('gux-button');
    Button.innerText = text;
    Button.setAttribute('onclick', onclickAction);
    Button.setAttribute('id',id);
    Button.setAttribute('accent', accent);
    Button.setAttribute('disabled',disabled);
    return(Button);
}

function createContextMenu(id, items)
{
   

    let menuDiv = document.createElement('div');
                     
    let contextMenu = document.createElement('gux-context-menu');
    contextMenu.setAttribute('id','context-' + id);
    contextMenu.setAttribute('compact','');
    contextMenu.setAttribute('data-cell-action','');

    for (let index = 0; index < items.length; index++) {
        const currentItem = items[index];

        let Item = document.createElement('gux-list-item');
        Item.setAttribute('onclick',currentItem.onClickAction);
        let text = document.createTextNode(currentItem.text);      
        Item.appendChild(text);
       
        contextMenu.appendChild(Item);
        
    }

    menuDiv.appendChild(contextMenu)
    return menuDiv;
          
}